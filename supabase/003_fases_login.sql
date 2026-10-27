-- =====================================================================
-- VFV Padel - migración 003
--  * Copia de seguridad de los datos en tablas backup_20261027_*
--  * Confirmación automática a los 2 días (antes 5)
--  * Fases programadas, editables y ocultables
--  * Solo usuarios con sesión pueden leer datos
-- Ejecutar entero en Supabase > SQL Editor después de 002_fases_avisos.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- Copia de seguridad (solo se crea la primera vez)
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['groups','teams','players','profiles','periods','group_entries','matches','notifications','announcements'] loop
    if to_regclass('public.backup_20261027_' || t) is null then
      execute format('create table public.%I as table public.%I', 'backup_20261027_' || t, t);
      -- Sin políticas: no se pueden leer desde la app, solo desde el panel de Supabase
      execute format('alter table public.%I enable row level security', 'backup_20261027_' || t);
      execute format('revoke all on public.%I from anon, authenticated', 'backup_20261027_' || t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Fases: programadas y visibles
-- ---------------------------------------------------------------------

alter table public.periods add column if not exists visible boolean not null default true;
alter table public.periods drop constraint if exists periods_status_check;
alter table public.periods add constraint periods_status_check check (status in ('planned', 'open', 'closed'));

-- ---------------------------------------------------------------------
-- Lectura solo con sesión iniciada
-- ---------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array['rankings','groups','teams','players','group_entries','matches','announcements'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('drop policy if exists "lectura con sesion" on public.%I', t);
    execute format('create policy "lectura con sesion" on public.%I for select to authenticated using (true)', t);
    execute format('revoke select on public.%I from anon', t);
  end loop;
end $$;

-- Las fases ocultas solo las ve el admin
drop policy if exists "lectura publica" on public.periods;
drop policy if exists "lectura con sesion" on public.periods;
create policy "lectura con sesion" on public.periods for select to authenticated
  using (visible or public.is_admin());
revoke select on public.periods from anon;

-- ---------------------------------------------------------------------
-- Confirmación automática a los 2 días
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
    raise exception 'La fase no está abierta';
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
    public.sets_label(p_sets) || '. Confírmalo o recházalo; si no, en 2 días se dará por bueno.'
  );
end $$;

create or replace function public.auto_confirm_expired()
returns int language plpgsql security definer set search_path = public as $$
declare m public.matches; n int := 0;
begin
  for m in
    select * from public.matches
    where status = 'reported' and reported_at < now() - interval '2 days'
    for update skip locked
  loop
    update public.matches set status = 'confirmed', confirmed_at = now() where id = m.id;
    insert into public.notifications (team_id, match_id, kind, message)
    select t, m.id, 'auto_confirmed',
      'El resultado de ' || public.match_label(m) || ' (' || public.sets_label(m.sets) ||
      ') se ha dado por bueno al no confirmarse ni rechazarse en 2 días.'
    from unnest(array[m.home_team_id, m.away_team_id]) as t;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------------------------------------------------------------------
-- Cerrar fase: abre la fase programada que se indique
-- ---------------------------------------------------------------------

drop function if exists public.close_period(uuid, jsonb, date, date);

create or replace function public.close_period(p_period uuid, p_results jsonb, p_next uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  per public.periods; nxt public.periods; r jsonb; g uuid;
begin
  perform public.auto_confirm_expired();

  select * into per from public.periods where id = p_period for update;
  if not found or per.status <> 'open' then raise exception 'La fase no está abierta'; end if;
  select * into nxt from public.periods where id = p_next for update;
  if not found or nxt.status <> 'planned' then raise exception 'La fase siguiente tiene que estar programada'; end if;
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
  update public.periods set status = 'open' where id = p_next;

  insert into public.group_entries (period_id, group_id, team_id)
  select p_next, (x ->> 'next_group_id')::uuid, t.id
  from jsonb_array_elements(p_results) x
  join public.teams t on t.id = (x ->> 'team_id')::uuid
  where t.active
  on conflict (period_id, team_id) do nothing;

  for g in select distinct group_id from public.group_entries where period_id = p_next loop
    perform public.sync_group_matches(p_next, g);
  end loop;

  return p_next;
end $$;

revoke execute on function public.close_period(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.close_period(uuid, jsonb, uuid) to service_role;
revoke execute on function public.auto_confirm_expired() from public, anon, authenticated;
grant execute on function public.auto_confirm_expired() to service_role;
