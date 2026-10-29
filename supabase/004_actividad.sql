-- =====================================================================
-- VFV Padel - migración 004
--  * Actividad de los usuarios: entradas (login), última entrada y visitas
-- Ejecutar entero en Supabase > SQL Editor después de 003_fases_login.sql
-- =====================================================================

alter table public.profiles add column if not exists login_count int not null default 0;
alter table public.profiles add column if not exists last_login_at timestamptz;
alter table public.profiles add column if not exists visit_count int not null default 0;
alter table public.profiles add column if not exists last_seen_at timestamptz;

-- Se llama justo después de iniciar sesión
create or replace function public.track_login()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set login_count = login_count + 1, last_login_at = now()
    where id = auth.uid();
end $$;

-- Una visita es cada vez que alguien vuelve a la app tras 30 minutos sin usarla
-- (el middleware solo la llama cuando no tiene la cookie de visita en curso)
create or replace function public.track_visit()
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.profiles
    set visit_count = visit_count + 1, last_seen_at = now()
    where id = auth.uid();
end $$;

revoke execute on function public.track_login() from public, anon;
revoke execute on function public.track_visit() from public, anon;
grant execute on function public.track_login() to authenticated;
grant execute on function public.track_visit() to authenticated;
