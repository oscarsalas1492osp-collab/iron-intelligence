-- ───────────────────────── Entrada solo con invitación ─────────────────────────
-- El ajuste público `access.mode` dice quién entra a la app: 'invite' (solo correos con acceso vigente y quien
-- administra) u 'open' (cualquiera). En modo invitación el servidor no deja crear cuentas a correos sin acceso.

-- Tipo de acceso: el tester prueba la app y recibe Pro sin costo; el invitado solo entra antes del lanzamiento.
alter table public.access_grants add column if not exists kind text not null default 'tester' check (kind in ('tester', 'guest'));
alter table public.access_grants add column if not exists invited_at timestamptz;   -- cuándo se le envió el correo de invitación

insert into public.app_flags (key, value) values ('access', jsonb_build_object('mode', 'invite')) on conflict (key) do nothing;

create or replace function public.access_mode() returns text
language sql security definer stable set search_path = '' as $$
  select case when (select f.value ->> 'mode' from public.app_flags f where f.key = 'access') = 'invite' then 'invite' else 'open' end
$$;

-- Antes de crear una cuenta: en modo invitación solo pasan los correos con acceso vigente.
create or replace function public.enforce_invitation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if public.access_mode() <> 'invite' then return new; end if;
  if new.email is not null and exists (select 1 from public.access_grants g where g.email = lower(new.email) and g.status = 'active') then return new; end if;
  raise exception 'invitation_required';
end $$;
create or replace trigger enforce_invitation before insert on auth.users for each row execute function public.enforce_invitation();

-- Aplica un acceso vigente a la cuenta con ese correo confirmado. El tester recibe además el plan Pro sin costo
-- (sin pisar una suscripción pagada); el invitado solo entra.
create or replace function public.apply_access(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); u uuid; v_role text;
begin
  select g.kind into v_role from public.access_grants g where g.email = v_email and g.status = 'active';
  if v_role is null then return false; end if;
  select x.id into u from auth.users x where lower(x.email) = v_email and x.email_confirmed_at is not null limit 1;
  if u is null then return false; end if;
  if v_role = 'tester' then
    insert into public.entitlements as e (user_id, plan, status, source, period_end, trial_used)
    values (u, 'pro', 'active', 'founder', null, true)
    on conflict (user_id) do update
      set status = 'active', source = 'founder', period_end = null, updated_at = now()
      where e.plan = 'pro' and not (e.source in ('web', 'play') and e.status in ('active', 'grace'));
  end if;
  update public.access_grants g set applied_at = coalesce(g.applied_at, now()) where g.email = v_email;
  return true;
end $$;

-- La app lo pregunta al abrir con una cuenta: si puede entrar y por qué.
create or replace function public.my_access() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text; v_role text; v_admin boolean := public.is_admin(); v_mode text := public.access_mode();
begin
  select lower(x.email) into v_email from auth.users x where x.id = (select auth.uid()) and x.email_confirmed_at is not null;
  if v_email is not null then
    if exists (select 1 from public.access_grants g where g.email = v_email and g.status = 'active' and g.applied_at is null) then
      perform public.apply_access(v_email);
    end if;
    select g.kind into v_role from public.access_grants g where g.email = v_email and g.status = 'active';
  end if;
  return jsonb_build_object('mode', v_mode, 'allowed', v_mode <> 'invite' or v_admin or v_role is not null, 'admin', v_admin, 'kind', v_role);
end $$;

create or replace function public.admin_set_access_mode(p_mode text) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_guard();
  if p_mode not in ('invite', 'open') then raise exception 'bad_mode'; end if;
  insert into public.app_flags (key, value, updated_at) values ('access', jsonb_build_object('mode', p_mode), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();
  insert into public.admin_log (admin_id, action, detail) values ((select auth.uid()), 'modo_de_acceso', p_mode);
  return p_mode;
end $$;

-- Invitar: da acceso a un correo como tester o como invitado. (La función anterior `admin_grant_access` queda sin uso.)
create or replace function public.admin_invite(p_email text, p_note text default null, p_kind text default 'tester') returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); applied boolean;
begin
  perform public.admin_guard();
  if char_length(v_email) > 120 or v_email !~ '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if p_kind not in ('tester', 'guest') then raise exception 'bad_kind'; end if;
  insert into public.access_grants as g (email, kind, status, note, granted_at, granted_by, revoked_at)
  values (v_email, p_kind, 'active', nullif(left(btrim(coalesce(p_note, '')), 200), ''), now(), (select auth.uid()), null)
  on conflict (email) do update
    set kind = excluded.kind, status = 'active', note = coalesce(excluded.note, g.note), granted_at = now(), granted_by = excluded.granted_by, revoked_at = null;
  applied := public.apply_access(v_email);
  insert into public.admin_log (admin_id, action, target, detail)
  values ((select auth.uid()), 'dar_acceso', v_email, p_kind || case when applied then ', cuenta existente' else ', sin cuenta todavía' end);
  return jsonb_build_object('email', v_email, 'has_account', applied, 'kind', p_kind);
end $$;

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
        select g.email, g.kind, g.status, g.note, g.granted_at, g.applied_at, g.revoked_at, g.invited_at,
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

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer stable set search_path = '' as $$
declare
  hoy date := (now() at time zone 'America/Santiago')::date;
begin
  perform public.admin_guard();
  return jsonb_build_object(
    'mode', public.access_mode(),
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
        'access', (select count(*) from public.access_grants g where g.status = 'active' and g.kind = 'tester'),
        'guests', (select count(*) from public.access_grants g where g.status = 'active' and g.kind = 'guest'),
        'with_account', (select count(*) from public.access_grants g where g.status = 'active'
                          and exists (select 1 from auth.users u where lower(u.email) = g.email)))
  );
end $$;

-- Correos enviados desde el panel (invitaciones, aviso de lanzamiento, pruebas). Solo escribe la función del servidor.
create table if not exists public.email_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  kind text not null check (kind in ('invitacion', 'lanzamiento', 'prueba')),
  to_email text not null,
  ok boolean not null,
  provider_id text,
  error text,
  admin_id uuid references auth.users(id) on delete set null
);
alter table public.email_log enable row level security;
revoke all on table public.email_log from anon, authenticated;
create index if not exists email_log_at_idx on public.email_log (at desc);

revoke all on function public.access_mode() from public, anon, authenticated;
-- `enforce_invitation` no se puede llamar suelta (solo como disparador), así que conserva sus permisos por defecto.
revoke all on function public.apply_access(text) from public, anon, authenticated;
revoke all on function public.my_access() from public, anon;
revoke all on function public.admin_set_access_mode(text) from public, anon;
revoke all on function public.admin_invite(text, text, text) from public, anon;
revoke all on function public.admin_testers() from public, anon;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.my_access() to authenticated;
grant execute on function public.admin_set_access_mode(text) to authenticated;
grant execute on function public.admin_invite(text, text, text) to authenticated;
grant execute on function public.admin_testers() to authenticated;
grant execute on function public.admin_overview() to authenticated;
