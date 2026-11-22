-- ───────────────────────── Panel interno (solo administradores) ─────────────────────────
-- Ninguna de estas tablas tiene políticas ni permisos directos. Todo pasa por funciones que primero
-- comprueban que quien llama esté en `app_admins`; a cualquier otra cuenta le responden «forbidden».

create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on table public.app_admins from anon, authenticated;

-- Accesos otorgados por correo. Se pueden dar antes de que la persona cree su cuenta: al crearla con ese
-- correo (y confirmarlo) queda como tester y con el plan Pro sin costo.
create table if not exists public.access_grants (
  email text primary key check (email = lower(email) and char_length(email) between 6 and 120),
  role text not null default 'tester' check (role in ('tester')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  note text check (note is null or char_length(note) <= 200),
  granted_at timestamptz not null default now(),
  granted_by uuid references auth.users(id) on delete set null,
  applied_at timestamptz,          -- cuándo la cuenta recibió el acceso
  revoked_at timestamptz
);
alter table public.access_grants enable row level security;
revoke all on table public.access_grants from anon, authenticated;

-- Registro de lo que se hace desde el panel.
create table if not exists public.admin_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  admin_id uuid references auth.users(id) on delete set null,
  action text not null,
  target text,
  detail text
);
alter table public.admin_log enable row level security;
revoke all on table public.admin_log from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = '' as $$
  select exists (select 1 from public.app_admins a where a.user_id = (select auth.uid()))
$$;

create or replace function public.admin_guard() returns void
language plpgsql security definer stable set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
end $$;

-- Aplica un acceso vigente a la cuenta que tenga ese correo confirmado. No pisa una suscripción pagada.
create or replace function public.apply_access(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); u uuid;
begin
  if not exists (select 1 from public.access_grants g where g.email = v_email and g.status = 'active') then return false; end if;
  select x.id into u from auth.users x where lower(x.email) = v_email and x.email_confirmed_at is not null limit 1;
  if u is null then return false; end if;
  insert into public.entitlements as e (user_id, plan, status, source, period_end, trial_used)
  values (u, 'pro', 'active', 'founder', null, true)
  on conflict (user_id) do update
    set status = 'active', source = 'founder', period_end = null, updated_at = now()
    where e.plan = 'pro' and not (e.source in ('web', 'play') and e.status in ('active', 'grace'));
  update public.access_grants g set applied_at = coalesce(g.applied_at, now()) where g.email = v_email;
  return true;
end $$;

-- La app la llama al abrir con una cuenta: si ese correo tiene un acceso pendiente, lo aplica.
create or replace function public.claim_access() returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text;
begin
  select lower(x.email) into v_email from auth.users x where x.id = (select auth.uid()) and x.email_confirmed_at is not null;
  if v_email is null then return false; end if;
  if exists (select 1 from public.access_grants g where g.email = v_email and g.status = 'active' and g.applied_at is null) then
    return public.apply_access(v_email);
  end if;
  return exists (select 1 from public.access_grants g where g.email = v_email and g.status = 'active');
end $$;

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'launch', (select jsonb_build_object(
        'total', count(*),
        'android', count(*) filter (where l.phone_os = 'android'),
        'iphone', count(*) filter (where l.phone_os = 'iphone'),
        'today', count(*) filter (where (l.created_at at time zone 'America/Santiago')::date = hoy),
        'week', count(*) filter (where l.created_at >= now() - interval '7 days'),
        'notified', count(*) filter (where l.notified_at is not null))
      from public.launch_signups l),
    'by_source', (select coalesce(jsonb_agg(jsonb_build_object('source', x.s, 'n', x.n) order by x.n desc, x.s), '[]'::jsonb)
      from (select coalesce(nullif(l.source, ''), 'directo') s, count(*) n from public.launch_signups l group by 1) x),
    'by_day', (select jsonb_agg(jsonb_build_object('d', g.d::date, 'n',
          (select count(*) from public.launch_signups l where (l.created_at at time zone 'America/Santiago')::date = g.d::date)) order by g.d)
      from generate_series(hoy - 13, hoy, interval '1 day') g(d)),
    'users', (select jsonb_build_object(
        'total', count(*),
        'week', count(*) filter (where u.created_at >= now() - interval '7 days'),
        'active_week', count(*) filter (where u.last_sign_in_at >= now() - interval '7 days'))
      from auth.users u),
    'training', (select count(distinct s.user_id) from public.sessions s where s.deleted = 0),
    'testers', jsonb_build_object(
        'signups', (select count(*) from public.tester_signups),
        'access', (select count(*) from public.access_grants g where g.status = 'active'),
        'with_account', (select count(*) from public.access_grants g where g.status = 'active'
                          and exists (select 1 from auth.users u where lower(u.email) = g.email)))
  );
end $$;

create or replace function public.admin_launch_list(p_q text default null, p_limit int default 200, p_offset int default 0) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'total', (select count(*) from public.launch_signups l where q is null or position(lower(q) in lower(l.email)) > 0),
    'rows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select l.email, l.phone_os, l.lang, l.source, l.created_at, l.notified_at,
               exists (select 1 from auth.users u where lower(u.email) = lower(l.email)) as has_account,
               (select g.status from public.access_grants g where g.email = lower(l.email)) as access
        from public.launch_signups l
        where q is null or position(lower(q) in lower(l.email)) > 0
        order by l.created_at desc
        limit least(greatest(coalesce(p_limit, 200), 1), 1000) offset greatest(coalesce(p_offset, 0), 0)) x)
  );
end $$;

create or replace function public.admin_users(p_q text default null, p_limit int default 100, p_offset int default 0) returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  q text := nullif(btrim(coalesce(p_q, '')), '');
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'total', (select count(*) from auth.users u where q is null or position(lower(q) in lower(coalesce(u.email, ''))) > 0),
    'rows', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select u.id, u.email, u.created_at, u.last_sign_in_at,
               (u.email_confirmed_at is not null) as confirmed,
               coalesce(u.raw_app_meta_data ->> 'provider', 'email') as provider,
               (select nullif(p.name, '') from public.profiles p where p.user_id = u.id and p.deleted = 0 order by p.updated_at desc limit 1) as name,
               (select count(*) from public.sessions s where s.user_id = u.id and s.deleted = 0 and s.status = 'done') as sessions,
               (select max(s.started_at) from public.sessions s where s.user_id = u.id and s.deleted = 0) as last_session,
               e.status as plan_status, e.source as plan_source, e.period_end as plan_end,
               (select g.status from public.access_grants g where g.email = lower(u.email)) as access,
               exists (select 1 from public.app_admins a where a.user_id = u.id) as admin
        from auth.users u left join public.entitlements e on e.user_id = u.id
        where q is null or position(lower(q) in lower(coalesce(u.email, ''))) > 0
        order by u.created_at desc
        limit least(greatest(coalesce(p_limit, 100), 1), 500) offset greatest(coalesce(p_offset, 0), 0)) x)
  );
end $$;

-- Accesos otorgados y postulaciones a tester. Antes de responder aplica los accesos cuya cuenta ya existe.
create or replace function public.admin_testers() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  r record;
begin
  perform public.admin_guard();
  for r in select g.email from public.access_grants g where g.status = 'active' and g.applied_at is null loop
    perform public.apply_access(r.email);
  end loop;
  return jsonb_build_object(
    'grants', (select coalesce(jsonb_agg(to_jsonb(x) order by x.granted_at desc), '[]'::jsonb) from (
        select g.email, g.status, g.note, g.granted_at, g.applied_at, g.revoked_at,
               exists (select 1 from auth.users u where lower(u.email) = g.email) as has_account,
               (select t.name from public.tester_signups t where lower(t.email) = g.email) as name,
               coalesce((select t.phone_os from public.tester_signups t where lower(t.email) = g.email),
                        (select l.phone_os from public.launch_signups l where lower(l.email) = g.email)) as phone_os
        from public.access_grants g) x),
    'signups', (select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc), '[]'::jsonb) from (
        select t.name, t.email, t.phone_os, t.days_per_week, t.logs_in, t.contact, t.source, t.created_at,
               exists (select 1 from auth.users u where lower(u.email) = lower(t.email)) as has_account,
               (select g.status from public.access_grants g where g.email = lower(t.email)) as access
        from public.tester_signups t) x)
  );
end $$;

create or replace function public.admin_grant_access(p_email text, p_note text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); applied boolean;
begin
  perform public.admin_guard();
  if char_length(v_email) > 120 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  insert into public.access_grants as g (email, status, note, granted_at, granted_by, revoked_at)
  values (v_email, 'active', nullif(left(btrim(coalesce(p_note, '')), 200), ''), now(), (select auth.uid()), null)
  on conflict (email) do update
    set status = 'active', note = coalesce(excluded.note, g.note), granted_at = now(), granted_by = excluded.granted_by, revoked_at = null;
  applied := public.apply_access(v_email);
  insert into public.admin_log (admin_id, action, target, detail)
  values ((select auth.uid()), 'dar_acceso', v_email, case when applied then 'cuenta existente' else 'sin cuenta todavía' end);
  return jsonb_build_object('email', v_email, 'has_account', applied);
end $$;

create or replace function public.admin_revoke_access(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform public.admin_guard();
  update public.access_grants g set status = 'revoked', revoked_at = now(), applied_at = null where g.email = v_email;
  if not found then raise exception 'not_found'; end if;
  update public.entitlements e set status = 'expired', updated_at = now()
  where e.source = 'founder' and e.user_id in (select u.id from auth.users u where lower(u.email) = v_email);
  insert into public.admin_log (admin_id, action, target) values ((select auth.uid()), 'quitar_acceso', v_email);
end $$;

create or replace function public.admin_remove_launch(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform public.admin_guard();
  delete from public.launch_signups l where lower(l.email) = v_email;
  if not found then raise exception 'not_found'; end if;
  insert into public.admin_log (admin_id, action, target) values ((select auth.uid()), 'borrar_del_aviso', v_email);
end $$;

-- Deja constancia de que ya se envió el aviso de lanzamiento a quienes estaban pendientes.
create or replace function public.admin_mark_notified() returns integer
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  perform public.admin_guard();
  update public.launch_signups l set notified_at = now() where l.notified_at is null;
  get diagnostics n = row_count;
  insert into public.admin_log (admin_id, action, detail) values ((select auth.uid()), 'marcar_avisados', n::text);
  return n;
end $$;

create or replace function public.admin_activity() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
begin
  perform public.admin_guard();
  return (select coalesce(jsonb_agg(to_jsonb(x) order by x.at desc), '[]'::jsonb)
          from (select a.at, a.action, a.target, a.detail from public.admin_log a order by a.at desc limit 30) x);
end $$;

-- Permisos: nada para visitantes; las cuentas solo llegan a las funciones, y estas comprueban al administrador.
revoke all on function public.is_admin() from public, anon;
revoke all on function public.admin_guard() from public, anon, authenticated;
revoke all on function public.apply_access(text) from public, anon, authenticated;
revoke all on function public.claim_access() from public, anon;
revoke all on function public.admin_overview() from public, anon;
revoke all on function public.admin_launch_list(text, int, int) from public, anon;
revoke all on function public.admin_users(text, int, int) from public, anon;
revoke all on function public.admin_testers() from public, anon;
revoke all on function public.admin_grant_access(text, text) from public, anon;
revoke all on function public.admin_revoke_access(text) from public, anon;
revoke all on function public.admin_remove_launch(text) from public, anon;
revoke all on function public.admin_mark_notified() from public, anon;
revoke all on function public.admin_activity() from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.claim_access() to authenticated;
grant execute on function public.admin_overview() to authenticated;
grant execute on function public.admin_launch_list(text, int, int) to authenticated;
grant execute on function public.admin_users(text, int, int) to authenticated;
grant execute on function public.admin_testers() to authenticated;
grant execute on function public.admin_grant_access(text, text) to authenticated;
grant execute on function public.admin_revoke_access(text) to authenticated;
grant execute on function public.admin_remove_launch(text) to authenticated;
grant execute on function public.admin_mark_notified() to authenticated;
grant execute on function public.admin_activity() to authenticated;
