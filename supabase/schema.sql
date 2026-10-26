-- =====================================================================
-- VFV Padel - esquema de base de datos (Supabase / Postgres)
-- Ejecutar entero en Supabase > SQL Editor > New query > Run
-- =====================================================================

-- ---------------------------------------------------------------------
-- Tablas
-- ---------------------------------------------------------------------

create table if not exists public.rankings (
  id smallint primary key,
  name text not null,
  slug text not null unique
);

insert into public.rankings (id, name, slug) values
  (1, 'Masculino', 'masculino'),
  (2, 'Femenino', 'femenino')
on conflict (id) do nothing;

-- level 1 = grupo más alto. El primero sube a level-1 y el último baja a level+1
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  ranking_id smallint not null references public.rankings(id),
  name text not null,
  level int not null,
  unique (ranking_id, level)
);

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  ranking_id smallint not null references public.rankings(id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  name text not null,
  position smallint not null default 1
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  role text not null check (role in ('admin', 'team')),
  team_id uuid references public.teams(id) on delete set null
);

create table if not exists public.periods (
  id uuid primary key default gen_random_uuid(),
  year int not null,
  month int not null check (month between 1 and 12),
  status text not null default 'open' check (status in ('open', 'closed')),
  closed_at timestamptz,
  unique (year, month)
);

-- Solo puede haber un mes abierto a la vez
create unique index if not exists periods_one_open on public.periods (status) where status = 'open';

-- En qué grupo está cada equipo cada mes, y cómo acabó
create table if not exists public.group_entries (
  period_id uuid not null references public.periods(id) on delete cascade,
  group_id uuid not null references public.groups(id),
  team_id uuid not null references public.teams(id),
  tiebreak int,          -- orden manual del admin para deshacer empates (1 = mejor)
  final_position int,
  movement text check (movement in ('up', 'down', 'stay')),
  primary key (period_id, team_id)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  period_id uuid not null references public.periods(id) on delete cascade,
  group_id uuid not null references public.groups(id),
  home_team_id uuid not null references public.teams(id),
  away_team_id uuid not null references public.teams(id),
  -- pending: sin resultado | reported: subido, falta confirmar | confirmed: confirmado por el rival
  -- disputed: el rival lo rechaza, lo resuelve el admin | resolved: puesto por el admin
  status text not null default 'pending'
    check (status in ('pending', 'reported', 'confirmed', 'disputed', 'resolved')),
  -- normal: 3 pts ganador, 1 perdedor | walkover: 3 ganador, 0 perdedor | void: 0 y 0
  result_type text not null default 'normal' check (result_type in ('normal', 'walkover', 'void')),
  sets jsonb,            -- [[6,4],[3,6],[10,8]] desde el punto de vista local-visitante
  winner_team_id uuid references public.teams(id),
  home_players uuid[],
  away_players uuid[],
  played_on date,
  reported_by_team_id uuid references public.teams(id),
  reported_at timestamptz,
  confirmed_at timestamptz,
  dispute_reason text,
  created_at timestamptz not null default now(),
  check (home_team_id <> away_team_id)
);

create index if not exists matches_period_idx on public.matches (period_id, group_id);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null default '',
  pinned boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Seguridad (RLS)
-- Lectura pública de la competición. Escritura solo vía funciones
-- (equipos) o con la clave secreta desde el servidor (admin).
-- ---------------------------------------------------------------------

alter table public.rankings enable row level security;
alter table public.groups enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;
alter table public.profiles enable row level security;
alter table public.periods enable row level security;
alter table public.group_entries enable row level security;
alter table public.matches enable row level security;
alter table public.announcements enable row level security;

do $$
declare t text;
begin
  foreach t in array array['rankings','groups','teams','players','periods','group_entries','matches','announcements'] loop
    execute format('drop policy if exists "lectura publica" on public.%I', t);
    execute format('create policy "lectura publica" on public.%I for select to anon, authenticated using (true)', t);
  end loop;
end $$;

drop policy if exists "perfil propio" on public.profiles;
create policy "perfil propio" on public.profiles for select to authenticated using (id = auth.uid());

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated;
grant all on all tables in schema public to service_role;

-- ---------------------------------------------------------------------
-- Funciones auxiliares
-- ---------------------------------------------------------------------

-- Devuelve 1 si gana el local, 2 si gana el visitante. Lanza error si no es válido.
create or replace function public.validate_sets(p_sets jsonb)
returns int language plpgsql immutable set search_path = public as $$
declare
  n int; h int; a int; hw int := 0; aw int := 0;
begin
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then
    raise exception 'Formato de sets no válido';
  end if;
  n := jsonb_array_length(p_sets);
  if n < 2 or n > 3 then
    raise exception 'Hay que indicar 2 o 3 sets';
  end if;
  for i in 0 .. n - 1 loop
    if hw = 2 or aw = 2 then
      raise exception 'Sobra el tercer set: el partido ya estaba decidido';
    end if;
    h := (p_sets -> i ->> 0)::int;
    a := (p_sets -> i ->> 1)::int;
    if h is null or a is null or h < 0 or a < 0 or h > 99 or a > 99 or h = a then
      raise exception 'El set % no es válido', i + 1;
    end if;
    if h > a then hw := hw + 1; else aw := aw + 1; end if;
  end loop;
  if hw < 2 and aw < 2 then
    raise exception 'Nadie ha ganado 2 sets';
  end if;
  return case when hw > aw then 1 else 2 end;
end $$;

create or replace function public.check_players(p uuid[], p_team uuid)
returns void language plpgsql set search_path = public as $$
begin
  if p is null or coalesce(array_length(p, 1), 0) <> 2 or p[1] = p[2] then
    raise exception 'Elige 2 jugadores distintos de cada equipo';
  end if;
  if (select count(*) from public.players where id = any(p) and team_id = p_team) <> 2 then
    raise exception 'Algún jugador no pertenece a su equipo';
  end if;
end $$;

create or replace function public.my_team_id()
returns uuid language sql stable security definer set search_path = public as $$
  select team_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------
-- Acciones de los equipos
-- ---------------------------------------------------------------------

create or replace function public.report_result(
  p_match uuid, p_sets jsonb, p_home_players uuid[], p_away_players uuid[], p_played_on date
) returns void language plpgsql security definer set search_path = public as $$
declare
  m public.matches; my_team uuid; w int;
begin
  my_team := public.my_team_id();
  if my_team is null then raise exception 'Tu usuario no tiene equipo'; end if;

  select * into m from public.matches where id = p_match for update;
  if not found then raise exception 'Partido no encontrado'; end if;
  if my_team not in (m.home_team_id, m.away_team_id) then raise exception 'No juegas este partido'; end if;
  if m.status <> 'pending' then raise exception 'Este partido ya tiene resultado'; end if;
  if (select status from public.periods where id = m.period_id) <> 'open' then
    raise exception 'El mes ya está cerrado';
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
end $$;

create or replace function public.dispute_result(p_match uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches; my_team uuid;
begin
  my_team := public.my_team_id();
  select * into m from public.matches where id = p_match for update;
  if not found or my_team is null or my_team not in (m.home_team_id, m.away_team_id) then
    raise exception 'No juegas este partido';
  end if;
  if m.status <> 'reported' then raise exception 'No hay resultado pendiente de confirmar'; end if;
  if m.reported_by_team_id = my_team then raise exception 'Lo tiene que revisar el equipo rival'; end if;
  update public.matches set status = 'disputed', dispute_reason = nullif(trim(p_reason), '') where id = p_match;
end $$;

-- El equipo que subió el resultado puede retirarlo mientras no esté confirmado
create or replace function public.withdraw_result(p_match uuid)
returns void language plpgsql security definer set search_path = public as $$
declare m public.matches; my_team uuid;
begin
  my_team := public.my_team_id();
  select * into m from public.matches where id = p_match for update;
  if not found or m.reported_by_team_id is distinct from my_team then
    raise exception 'Solo puede retirarlo quien lo subió';
  end if;
  if m.status <> 'reported' then raise exception 'El resultado ya no se puede retirar'; end if;
  update public.matches set
    status = 'pending', sets = null, winner_team_id = null, home_players = null, away_players = null,
    played_on = null, reported_by_team_id = null, reported_at = null
  where id = p_match;
end $$;

-- ---------------------------------------------------------------------
-- Funciones de administración (solo con la clave secreta, desde el servidor)
-- ---------------------------------------------------------------------

-- Deja los partidos del grupo como todos contra todos según los equipos que tiene
create or replace function public.sync_group_matches(p_period uuid, p_group uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.matches m
  where m.period_id = p_period and m.group_id = p_group
    and (
      not exists (select 1 from public.group_entries e
                  where e.period_id = p_period and e.group_id = p_group and e.team_id = m.home_team_id)
      or not exists (select 1 from public.group_entries e
                     where e.period_id = p_period and e.group_id = p_group and e.team_id = m.away_team_id)
    );

  insert into public.matches (period_id, group_id, home_team_id, away_team_id)
  select p_period, p_group, a.team_id, b.team_id
  from public.group_entries a
  join public.group_entries b
    on b.period_id = a.period_id and b.group_id = a.group_id and a.team_id < b.team_id
  where a.period_id = p_period and a.group_id = p_group
    and not exists (
      select 1 from public.matches m
      where m.period_id = p_period and m.group_id = p_group
        and ((m.home_team_id = a.team_id and m.away_team_id = b.team_id)
          or (m.home_team_id = b.team_id and m.away_team_id = a.team_id))
    );
end $$;

-- Cierra el mes en una sola transacción y abre el siguiente con los ascensos/descensos.
-- p_results: [{ "team_id", "final_position", "movement", "next_group_id" }]
create or replace function public.close_period(p_period uuid, p_results jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  per public.periods; new_id uuid; r jsonb; g uuid;
begin
  select * into per from public.periods where id = p_period for update;
  if not found or per.status <> 'open' then raise exception 'El mes no está abierto'; end if;
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

  insert into public.periods (year, month)
  values (
    case when per.month = 12 then per.year + 1 else per.year end,
    case when per.month = 12 then 1 else per.month + 1 end
  )
  returning id into new_id;

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

revoke execute on function public.sync_group_matches(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.close_period(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_group_matches(uuid, uuid) to service_role;
grant execute on function public.close_period(uuid, jsonb) to service_role;

revoke execute on function public.report_result(uuid, jsonb, uuid[], uuid[], date) from public, anon;
revoke execute on function public.confirm_result(uuid) from public, anon;
revoke execute on function public.dispute_result(uuid, text) from public, anon;
revoke execute on function public.withdraw_result(uuid) from public, anon;
grant execute on function public.report_result(uuid, jsonb, uuid[], uuid[], date) to authenticated;
grant execute on function public.confirm_result(uuid) to authenticated;
grant execute on function public.dispute_result(uuid, text) to authenticated;
grant execute on function public.withdraw_result(uuid) to authenticated;
