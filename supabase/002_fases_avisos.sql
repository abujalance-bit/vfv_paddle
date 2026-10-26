-- =====================================================================
-- VFV Padel - migración 002
--  * Fases por rango de fechas (en vez de meses)
--  * 2 o 3 jugadores por equipo en cada partido
--  * Avisos (notificaciones) a equipos y admin
--  * Resultado confirmado automáticamente a los 5 días
-- Ejecutar entero en Supabase > SQL Editor después de schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Fases por fechas
-- ---------------------------------------------------------------------

alter table public.periods add column if not exists start_date date;
alter table public.periods add column if not exists end_date date;

do $$
begin
  if exists (select 1 from information_schema.columns
             where table_schema = 'public' and table_name = 'periods' and column_name = 'year') then
    update public.periods
      set start_date = make_date(year, month, 1),
          end_date = (make_date(year, month, 1) + interval '1 month' - interval '1 day')::date
      where start_date is null;
    alter table public.periods drop column year, drop column month;
  end if;
end $$;

alter table public.periods alter column start_date set not null;
alter table public.periods alter column end_date set not null;
alter table public.periods drop constraint if exists periods_dates_check;
alter table public.periods add constraint periods_dates_check check (end_date >= start_date);

-- ---------------------------------------------------------------------
-- Avisos
-- ---------------------------------------------------------------------

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade,   -- destinatario: un equipo...
  for_admin boolean not null default false,                      -- ...o el administrador
  match_id uuid references public.matches(id) on delete cascade,
  kind text not null check (kind in ('reported', 'confirmed', 'auto_confirmed', 'disputed', 'resolved')),
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (team_id is not null or for_admin)
);

create index if not exists notifications_team_idx on public.notifications (team_id, created_at desc);
create index if not exists notifications_admin_idx on public.notifications (for_admin, created_at desc);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

alter table public.notifications enable row level security;
drop policy if exists "avisos propios" on public.notifications;
create policy "avisos propios" on public.notifications for select to authenticated
  using (team_id = public.my_team_id() or (for_admin and public.is_admin()));

grant select on public.notifications to authenticated;
grant all on public.notifications to service_role;

create or replace function public.mark_notifications_read()
returns void language sql security definer set search_path = public as $$
  update public.notifications set read_at = now()
  where read_at is null and (team_id = public.my_team_id() or (for_admin and public.is_admin()))
$$;

-- "Equipo A vs Equipo B"
create or replace function public.match_label(m public.matches)
returns text language sql stable set search_path = public as $$
  select (select name from public.teams where id = m.home_team_id) || ' vs ' ||
         (select name from public.teams where id = m.away_team_id)
$$;

-- "6-4 3-6 10-8"
create or replace function public.sets_label(p_sets jsonb)
returns text language sql immutable as $$
  select coalesce(string_agg((s ->> 0) || '-' || (s ->> 1), ' ' order by o), '')
  from jsonb_array_elements(p_sets) with ordinality as x(s, o)
$$;

create or replace function public.team_name(p_team uuid)
returns text language sql stable set search_path = public as $$
  select name from public.teams where id = p_team
$$;

-- ---------------------------------------------------------------------
-- Jugadores: 2 o 3 por equipo
-- ---------------------------------------------------------------------

create or replace function public.check_players(p uuid[], p_team uuid)
returns void language plpgsql set search_path = public as $$
declare n int := coalesce(array_length(p, 1), 0);
begin
  if n < 2 or n > 3 then
    raise exception 'Elige 2 o 3 jugadores de cada equipo';
  end if;
  if (select count(distinct x) from unnest(p) as x) <> n then
    raise exception 'Hay jugadores repetidos';
  end if;
  if (select count(*) from public.players where id = any(p) and team_id = p_team) <> n then
    raise exception 'Algún jugador no pertenece a su equipo';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Acciones de los equipos, ahora con avisos
-- ---------------------------------------------------------------------

create or replace function public.report_result(
  p_match uuid, p_sets jsonb, p_home_players uuid[], p_away_players uuid[], p_played_on date
) returns void language plpgsql security definer set search_path = public as $$
declare
  m public.matches; my_team uuid; rival uuid; w int;
begin
  my_team := public.my_team_id();
  if my_team is null then raise exception 'Tu usuario no tiene equipo'; end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'Partido no encontrado'; end if;
  if my_team not in (m.home_team_id, m.away_team_id) then raise exception 'No juegas este partido'; end if;
  if m.status <> 'pending' then raise exception 'Este partido ya tiene resultado'; end if;
  if (select status from public.periods where id = m.period_id) <> 'open' then
    raise exception 'La fase ya está cerrada';
  end if;

  perform public.check_players(p_home_players, m.home_team_id);
  perform public.check_players(p_away_players, m.away_team_id);
  w := public.validate_sets(p_sets);

  update public.matches set
    status = 'reported',
    result_type = 'normal',
    sets = p_sets,
    winner_team_id = case when w = 1 then m.home_team_id else m.away_team_id end,
    home_players = p_home_players,
    away_players = p_away_players,
    played_on = p_played_on,
    reported_by_team_id = my_team,
    reported_at = now(),
    confirmed_at = null,
    dispute_reason = null
  where id = p_match;

  rival := case when my_team = m.home_team_id then m.away_team_id else m.home_team_id end;
  insert into public.notifications (team_id, match_id, kind, message) values (
    rival, p_match, 'reported',
    public.team_name(my_team) || ' ha subido el resultado de ' || public.match_label(m) || ': ' ||
    public.sets_label(p_sets) || '. Confírmalo o recházalo; si no, en 5 días se dará por bueno.'
  );
end $$;

create or replace function public.confirm_result(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches; my_team uuid;
begin
  my_team := public.my_team_id();
  select * into m from public.matches where id = p_match for update;
  if not found or my_team is null or my_team not in (m.home_team_id, m.away_team_id) then
    raise exception 'No juegas este partido';
  end if;
  if m.status <> 'reported' then raise exception 'No hay resultado pendiente de confirmar'; end if;
  if m.reported_by_team_id = my_team then raise exception 'Lo tiene que confirmar el equipo rival'; end if;

  update public.matches set status = 'confirmed', confirmed_at = now() where id = p_match;

  insert into public.notifications (team_id, match_id, kind, message) values (
    m.reported_by_team_id, p_match, 'confirmed',
    public.team_name(my_team) || ' ha confirmado el resultado de ' || public.match_label(m) || ': ' ||
    public.sets_label(m.sets) || '.'
  );
end $$;

create or replace function public.dispute_result(p_match uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches; my_team uuid; reason text := nullif(trim(p_reason), '');
begin
  my_team := public.my_team_id();
  select * into m from public.matches where id = p_match for update;
  if not found or my_team is null or my_team not in (m.home_team_id, m.away_team_id) then
    raise exception 'No juegas este partido';
  end if;
  if m.status <> 'reported' then raise exception 'No hay resultado pendiente de confirmar'; end if;
  if m.reported_by_team_id = my_team then raise exception 'Lo tiene que revisar el equipo rival'; end if;

  update public.matches set status = 'disputed', dispute_reason = reason where id = p_match;

  insert into public.notifications (team_id, match_id, kind, message) values (
    m.reported_by_team_id, p_match, 'disputed',
    public.team_name(my_team) || ' ha rechazado el resultado de ' || public.match_label(m) ||
    coalesce(' (' || reason || ')', '') || '. El administrador lo revisará.'
  );
  insert into public.notifications (for_admin, match_id, kind, message) values (
    true, p_match, 'disputed',
    'Resultado rechazado en ' || public.match_label(m) || ': ' || public.sets_label(m.sets) ||
    ', rechazado por ' || public.team_name(my_team) || coalesce(' (' || reason || ')', '') || '. Revísalo.'
  );
end $$;

-- ---------------------------------------------------------------------
-- Confirmación automática a los 5 días
-- ---------------------------------------------------------------------

create or replace function public.auto_confirm_expired()
returns int language plpgsql security definer set search_path = public as $$
declare m public.matches; n int := 0;
begin
  for m in
    select * from public.matches
    where status = 'reported' and reported_at < now() - interval '5 days'
    for update skip locked
  loop
    update public.matches set status = 'confirmed', confirmed_at = now() where id = m.id;
    insert into public.notifications (team_id, match_id, kind, message)
    select t, m.id, 'auto_confirmed',
      'El resultado de ' || public.match_label(m) || ' (' || public.sets_label(m.sets) ||
      ') se ha dado por bueno al no confirmarse ni rechazarse en 5 días.'
    from unnest(array[m.home_team_id, m.away_team_id]) as t;
    n := n + 1;
  end loop;
  return n;
end $$;

-- Revisión cada hora con pg_cron (si no está disponible, la app lo revisa al cargar las páginas)
do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('auto-confirmar-resultados', '0 * * * *', 'select public.auto_confirm_expired()');
exception when others then
  raise notice 'pg_cron no disponible: %', sqlerrm;
end $$;

-- ---------------------------------------------------------------------
-- Cerrar fase: abre la siguiente con las fechas indicadas
-- ---------------------------------------------------------------------

drop function if exists public.close_period(uuid, jsonb);

create or replace function public.close_period(p_period uuid, p_results jsonb, p_start date, p_end date)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  per public.periods; new_id uuid; r jsonb; g uuid;
begin
  perform public.auto_confirm_expired();

  select * into per from public.periods where id = p_period for update;
  if not found or per.status <> 'open' then raise exception 'La fase no está abierta'; end if;
  if p_start is null or p_end is null or p_end < p_start then
    raise exception 'Fechas de la nueva fase no válidas';
  end if;
  if exists (select 1 from public.matches
             where period_id = p_period and status in ('pending', 'reported', 'disputed')) then
    raise exception 'Quedan partidos sin resolver';
  end if;

  for r in select * from jsonb_array_elements(p_results) loop
    update public.group_entries
      set final_position = (r ->> 'final_position')::int, movement = r ->> 'movement'
      where period_id = p_period and team_id = (r ->> 'team_id')::uuid;
  end loop;

  update public.periods set status = 'closed', closed_at = now() where id = p_period;

  insert into public.periods (start_date, end_date) values (p_start, p_end) returning id into new_id;

  insert into public.group_entries (period_id, group_id, team_id)
  select new_id, (x ->> 'next_group_id')::uuid, t.id
  from jsonb_array_elements(p_results) x
  join public.teams t on t.id = (x ->> 'team_id')::uuid
  where t.active;

  for g in select distinct group_id from public.group_entries where period_id = new_id loop
    perform public.sync_group_matches(new_id, g);
  end loop;

  return new_id;
end $$;

-- ---------------------------------------------------------------------
-- Permisos de ejecución
-- ---------------------------------------------------------------------

revoke execute on function public.close_period(uuid, jsonb, date, date) from public, anon, authenticated;
revoke execute on function public.auto_confirm_expired() from public, anon, authenticated;
grant execute on function public.close_period(uuid, jsonb, date, date) to service_role;
grant execute on function public.auto_confirm_expired() to service_role;

revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.mark_notifications_read() to authenticated;
