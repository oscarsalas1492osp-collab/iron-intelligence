-- IRON INTELLIGENCE · Esquema de base de datos (Supabase / PostgreSQL)
-- Ejecutar una vez en: Supabase → SQL Editor.
--
-- Relaciones:  auth.users 1─1 profiles
--              auth.users 1─N exercises, routines, sessions, recovery_logs, body_weights
--              routines   1─N routine_items
--              sessions   1─N set_logs        (cada serie es una fila)
-- Seguridad:   Row Level Security en todas las tablas: cada usuario solo ve y modifica sus filas.
-- Sincronización: `updated_at` (ms, reloj del cliente) resuelve conflictos; `synced_at` (servidor)
--              es el cursor de descarga; `deleted` propaga los borrados.

create or replace function public.touch_synced_at() returns trigger language plpgsql set search_path = '' as $$
begin new.synced_at := clock_timestamp(); return new; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  name text not null default '', age int check (age between 10 and 100), sex text not null default '',
  height_cm numeric check (height_cm between 100 and 250),
  experience text not null check (experience in ('beginner','intermediate','advanced')),
  goal text not null check (goal in ('hypertrophy','strength','recomposition','maintenance')),
  days_available int not null check (days_available between 1 and 7),
  equipment jsonb not null default '[]', priority_muscles jsonb not null default '[]',
  half_rir boolean not null default false, indirect_coef numeric not null default 0.5 check (indirect_coef between 0 and 1)
);

create table if not exists public.exercises (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  base_id text, name text not null, "primary" text not null, secondary jsonb not null default '[]',
  type text not null check (type in ('compound','isolation')), equipment text not null, machine text not null default '',
  cues jsonb not null default '[]', mistakes jsonb not null default '[]', rom text not null default '',
  execution text not null default '', safety text not null default '', increment numeric not null check (increment > 0),
  photo text, custom boolean not null default true,
  focus text not null default '', aka text not null default '',
  measure text not null default 'reps' check (measure in ('reps','time','distance')),
  category text not null default 'strength' check (category in ('strength','functional','power','calisthenics'))
);
-- Instalaciones anteriores al catálogo ampliado: añade las columnas nuevas sin tocar los datos.
alter table public.exercises add column if not exists focus text not null default '';
alter table public.exercises add column if not exists aka text not null default '';
alter table public.exercises add column if not exists measure text not null default 'reps' check (measure in ('reps','time','distance'));
alter table public.exercises add column if not exists category text not null default 'strength' check (category in ('strength','functional','power','calisthenics'));

create table if not exists public.routines (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  name text not null, split text not null default '', days jsonb not null default '[]', "order" numeric not null default 0
);

create table if not exists public.routine_items (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  routine_id text not null references public.routines (id) on delete cascade,
  exercise_id text not null, "order" numeric not null default 0,
  sets int not null check (sets between 1 and 12),
  rep_min int not null, rep_max int not null check (rep_max >= rep_min),
  rir_min numeric not null, rir_max numeric not null check (rir_max >= rir_min),
  rest_sec int not null check (rest_sec between 0 and 900)
);

create table if not exists public.sessions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  routine_id text, name text not null default '', started_at bigint not null, ended_at bigint,
  status text not null check (status in ('active','paused','done')),
  paused_at bigint, paused_ms bigint not null default 0, notes text not null default '',
  exercise_ids jsonb not null default '[]', targets jsonb not null default '{}'
);

create table if not exists public.set_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  session_id text not null references public.sessions (id) on delete cascade,
  exercise_id text not null, "order" int not null,
  weight numeric not null check (weight between 0 and 1000),
  reps int not null check (reps between 0 and 200),
  rir numeric check (rir between 0 and 10), rpe numeric check (rpe between 1 and 10),
  failure boolean not null default false,
  end_reason text not null default 'none' check (end_reason in ('none','momentary','technical','voluntary','fatigue')),
  met_target boolean not null default false, done boolean not null default false,
  completed_at bigint, rest_sec numeric, note text not null default ''
);

-- Biseries/triseries y técnicas avanzadas (columnas añadidas sin tocar los datos existentes).
alter table public.routine_items add column if not exists superset text;
alter table public.sessions add column if not exists supersets jsonb not null default '[]';
alter table public.set_logs add column if not exists technique text not null default '' check (technique in ('','drop','restpause','myo','cluster'));
alter table public.set_logs add column if not exists sub int not null default 0 check (sub between 0 and 12);

create table if not exists public.recovery_logs (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  date text not null, sleep_hours numeric not null, sleep_quality int not null, fatigue int not null,
  soreness int not null, motivation int not null, stress int not null
);

create table if not exists public.body_weights (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  date text not null, kg numeric not null check (kg between 25 and 300)
);

do $$
declare t text;
begin
  foreach t in array array['profiles','exercises','routines','routine_items','sessions','set_logs','recovery_logs','body_weights'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists own_rows on public.%I', t);
    execute format('create policy own_rows on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t);
    execute format('drop trigger if exists touch_synced on public.%I', t);
    execute format('create trigger touch_synced before insert or update on public.%I for each row execute function public.touch_synced_at()', t);
    execute format('create index if not exists %I on public.%I (user_id, synced_at)', t || '_sync_idx', t);
  end loop;
end $$;

create index if not exists set_logs_session_idx on public.set_logs (session_id);
create index if not exists set_logs_exercise_idx on public.set_logs (user_id, exercise_id);
create index if not exists routine_items_routine_idx on public.routine_items (routine_id);

-- Eliminación de cuenta: cada persona puede borrar la suya. Los datos de todas las tablas se van en cascada.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- Ajustes del usuario (ciclo, barra y discos, avisos, valoraciones) y medidas corporales.
alter table public.profiles add column if not exists settings jsonb not null default '{}';
create table if not exists public.body_measures (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  updated_at bigint not null, deleted smallint not null default 0, synced_at timestamptz not null default clock_timestamp(),
  date text not null, "values" jsonb not null default '{}'
);
alter table public.body_measures enable row level security;
drop policy if exists own_rows on public.body_measures;
create policy own_rows on public.body_measures for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop trigger if exists touch_synced on public.body_measures;
create trigger touch_synced before insert or update on public.body_measures for each row execute function public.touch_synced_at();
create index if not exists body_measures_sync_idx on public.body_measures (user_id, synced_at);

-- Modo entrenador. El deportista crea la invitación; nadie ve sus datos hasta que él la crea y el entrenador la acepta.
create table if not exists public.coach_links (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users (id) on delete cascade default auth.uid(),
  coach_id uuid references auth.users (id) on delete cascade,
  code text not null unique check (char_length(code) between 6 and 16),
  client_name text not null default '' check (char_length(client_name) <= 60),
  coach_name text not null default '' check (char_length(coach_name) <= 60),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
create index if not exists coach_links_coach_idx on public.coach_links (coach_id);
create index if not exists coach_links_client_idx on public.coach_links (client_id);
alter table public.coach_links enable row level security;
drop policy if exists client_read on public.coach_links;
drop policy if exists client_invite on public.coach_links;
drop policy if exists client_revoke on public.coach_links;
drop policy if exists coach_read on public.coach_links;
drop policy if exists coach_leave on public.coach_links;
create policy client_read on public.coach_links for select to authenticated using (client_id = (select auth.uid()));
create policy client_invite on public.coach_links for insert to authenticated with check (client_id = (select auth.uid()) and coach_id is null and accepted_at is null);
create policy client_revoke on public.coach_links for delete to authenticated using (client_id = (select auth.uid()));
create policy coach_read on public.coach_links for select to authenticated using (coach_id = (select auth.uid()));
create policy coach_leave on public.coach_links for delete to authenticated using (coach_id = (select auth.uid()));

create or replace function public.is_coach_of(p_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.coach_links l where l.coach_id = (select auth.uid()) and l.client_id = p_client and l.accepted_at is not null);
$$;
revoke all on function public.is_coach_of(uuid) from public, anon;
grant execute on function public.is_coach_of(uuid) to authenticated;

-- El entrenador acepta con el código que le pasó el deportista (vigente 7 días, un solo uso).
create or replace function public.accept_coach_invite(p_code text, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  l public.coach_links;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into l from public.coach_links where code = upper(trim(p_code)) and coach_id is null and created_at > now() - interval '7 days' for update;
  if not found then raise exception 'invalid_code' using errcode = 'P0001'; end if;
  if l.client_id = uid then raise exception 'own_code' using errcode = 'P0001'; end if;
  update public.coach_links set coach_id = uid, coach_name = left(coalesce(p_name, ''), 60), accepted_at = now() where id = l.id;
  return l.client_id;
end;
$$;
revoke all on function public.accept_coach_invite(text, text) from public, anon;
grant execute on function public.accept_coach_invite(text, text) to authenticated;

-- Lo que ve el entrenador: entrenamientos, series, rutinas y ejercicios propios. No ve recuperación, peso, medidas ni perfil.
-- Puede enviar rutinas (solo añadir): nunca modificar ni borrar lo del deportista.
do $$
declare t text;
begin
  foreach t in array array['sessions','set_logs','routines','routine_items','exercises'] loop
    execute format('drop policy if exists coach_read on public.%I', t);
    execute format('create policy coach_read on public.%I for select to authenticated using (public.is_coach_of(user_id))', t);
  end loop;
  foreach t in array array['routines','routine_items','exercises'] loop
    execute format('drop policy if exists coach_send on public.%I', t);
    execute format('create policy coach_send on public.%I for insert to authenticated with check (public.is_coach_of(user_id))', t);
  end loop;
end $$;


-- ───────────────────────── Inscripción de testers (página pública /web) ─────────────────────────
-- La tabla no tiene políticas ni permisos directos: con la clave pública solo se entra por las dos funciones.
create table if not exists public.tester_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 60),
  email text not null check (char_length(email) between 6 and 120),
  phone_os text not null check (phone_os in ('android', 'iphone')),
  days_per_week text not null check (days_per_week in ('1-2', '3-4', '5+')),
  logs_in text not null check (logs_in in ('notas', 'papel', 'otra_app', 'ninguna')),
  contact text check (contact is null or char_length(contact) <= 120),
  adult boolean not null check (adult),
  source text check (source is null or char_length(source) <= 40)
);
create unique index if not exists tester_signups_email_key on public.tester_signups (lower(email));
alter table public.tester_signups enable row level security;
revoke all on table public.tester_signups from anon, authenticated;

create or replace function public.join_testers(
  p_name text, p_email text, p_phone_os text, p_days text, p_logs text,
  p_contact text default null, p_adult boolean default false, p_source text default null
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not coalesce(p_adult, false) then raise exception 'adult_required'; end if;
  if p_email is null or p_email !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if (select count(*) from public.tester_signups) >= 2000 then raise exception 'full'; end if;
  insert into public.tester_signups (name, email, phone_os, days_per_week, logs_in, contact, adult, source)
  values (btrim(p_name), lower(btrim(p_email)), p_phone_os, p_days, p_logs,
          nullif(btrim(coalesce(p_contact, '')), ''), true, nullif(left(coalesce(p_source, ''), 40), ''))
  on conflict (lower(email)) do nothing;
end $$;

create or replace function public.tester_count() returns integer
language sql security definer stable set search_path = '' as $$
  select count(*)::int from public.tester_signups
$$;

revoke all on function public.join_testers(text, text, text, text, text, text, boolean, text) from public;
revoke all on function public.tester_count() from public;
grant execute on function public.join_testers(text, text, text, text, text, text, boolean, text) to anon, authenticated;
grant execute on function public.tester_count() to anon, authenticated;


-- ---------------------------------------------------------------------------
-- Planes y cobro (supabase/migrations/planes_y_cobro_base.sql)
-- ---------------------------------------------------------------------------
-- Planes y cobro. Apagado por defecto: mientras billing.enabled sea false, toda la app es gratis para todos.

-- Ajustes públicos de la app (lectura para cualquiera, escritura solo desde el panel o el rol de servicio).
create table if not exists public.app_flags (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.app_flags enable row level security;
create policy "lectura publica de ajustes" on public.app_flags for select to anon, authenticated using (true);
revoke insert, update, delete, truncate on table public.app_flags from anon, authenticated;

insert into public.app_flags (key, value) values ('billing', jsonb_build_object(
  'enabled', false,
  'trial_days', 21,
  'free_routines', 2,
  'free_history_days', 30,
  'free_custom_exercises', 3,
  'pro_only', jsonb_build_array('supersets', 'techniques', 'suggestions', 'templates', 'warmup', 'recovery', 'assistant'),
  'prices', jsonb_build_object(
    'CLP', jsonb_build_object('monthly', 4990, 'yearly', 39990),
    'USD', jsonb_build_object('monthly', 4.99, 'yearly', 39.99)
  ),
  'checkout', jsonb_build_object('monthly', null, 'yearly', null)
)) on conflict (key) do nothing;

-- Plan de cada usuario. Solo lo escriben el servidor (avisos del medio de pago) y las funciones de abajo.
create table if not exists public.entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'pro' check (plan in ('pro', 'coach')),
  status text not null check (status in ('trialing', 'active', 'grace', 'canceled', 'expired')),
  source text not null check (source in ('trial', 'founder', 'manual', 'play', 'web')),
  period_end timestamptz,                         -- null: sin vencimiento
  trial_used boolean not null default false,
  provider_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.entitlements enable row level security;
create policy "cada usuario lee su plan" on public.entitlements for select to authenticated using ((select auth.uid()) = user_id);
revoke all on table public.entitlements from anon;
revoke insert, update, delete, truncate on table public.entitlements from authenticated;

-- Prueba gratis de Pro: una sola vez por cuenta, sin tarjeta, y solo si el cobro está activado.
create or replace function public.start_trial() returns public.entitlements
language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb; days int; r public.entitlements; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select value into cfg from public.app_flags where key = 'billing';
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'billing_disabled'; end if;
  days := least(greatest(coalesce((cfg->>'trial_days')::int, 21), 1), 60);
  insert into public.entitlements (user_id, plan, status, source, period_end, trial_used)
  values (uid, 'pro', 'trialing', 'trial', now() + make_interval(days => days), true)
  on conflict (user_id) do nothing
  returning * into r;
  if r.user_id is null then select * into r from public.entitlements where user_id = uid; end if;
  return r;
end $$;
revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- Regalo de plan (testers fundadores, cortesías). Solo se puede llamar desde el panel o el rol de servicio.
create or replace function public.grant_plan(p_email text, p_months int default null, p_source text default 'founder') returns public.entitlements
language plpgsql security definer set search_path = '' as $$
declare
  u uuid; r public.entitlements;
begin
  select id into u from auth.users where lower(email) = lower(trim(p_email));
  if u is null then raise exception 'user_not_found'; end if;
  insert into public.entitlements (user_id, plan, status, source, period_end, trial_used)
  values (u, 'pro', 'active', p_source, case when p_months is null then null else now() + make_interval(months => p_months) end, true)
  on conflict (user_id) do update
    set plan = 'pro', status = 'active', source = excluded.source, period_end = excluded.period_end, updated_at = now()
  returning * into r;
  return r;
end $$;
revoke execute on function public.grant_plan(text, int, text) from public, anon, authenticated;
-- Cobro por Mercado Pago: registro de las suscripciones que cada cuenta inicia y modo de prueba por cuenta.

-- Suscripciones iniciadas desde la app. Solo el servidor (rol de servicio) lee y escribe: sin políticas.
create table if not exists public.payment_intents (
  provider_ref text primary key,                                   -- «mp:<id de la suscripción en Mercado Pago>»
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('monthly', 'yearly')),
  created_at timestamptz not null default now()
);
alter table public.payment_intents enable row level security;
create index if not exists payment_intents_user_idx on public.payment_intents (user_id, created_at desc);
revoke all on public.payment_intents from anon, authenticated;

-- La prueba gratis también vale para las cuentas de `billing.preview`, que ven los planes antes del lanzamiento.
create or replace function public.start_trial() returns public.entitlements
language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb; days int; r public.entitlements; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select value into cfg from public.app_flags where key = 'billing';
  if not (coalesce((cfg->>'enabled')::boolean, false) or coalesce(cfg->'preview', '[]'::jsonb) ? uid::text) then raise exception 'billing_disabled'; end if;
  days := least(greatest(coalesce((cfg->>'trial_days')::int, 21), 1), 60);
  insert into public.entitlements (user_id, plan, status, source, period_end, trial_used)
  values (uid, 'pro', 'trialing', 'trial', now() + make_interval(days => days), true)
  on conflict (user_id) do nothing
  returning * into r;
  if r.user_id is null then select * into r from public.entitlements where user_id = uid; end if;
  return r;
end $$;
revoke execute on function public.start_trial() from public, anon;
grant execute on function public.start_trial() to authenticated;

-- ───────────────────────── Aviso de lanzamiento (página pública /web) ─────────────────────────
-- La tabla no tiene políticas ni permisos directos: con la clave pública solo se entra por las dos funciones.
create table if not exists public.launch_signups (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null check (char_length(email) between 6 and 120),
  phone_os text check (phone_os is null or phone_os in ('android', 'iphone')),
  lang text check (lang is null or char_length(lang) <= 12),
  source text check (source is null or char_length(source) <= 40),
  ip_hash text,                 -- huella del día de la dirección de origen, solo para frenar envíos automáticos
  notified_at timestamptz       -- se completa al enviar el aviso
);
create unique index if not exists launch_signups_email_key on public.launch_signups (lower(email));
create index if not exists launch_signups_ip_hash_idx on public.launch_signups (ip_hash) where ip_hash is not null;
alter table public.launch_signups enable row level security;
revoke all on table public.launch_signups from anon, authenticated;

create or replace function public.join_launch_list(
  p_email text, p_phone_os text default null, p_lang text default null, p_source text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_ip text := nullif(btrim(split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_hash text := case when v_ip is null then null else md5(v_ip || current_date::text) end;
begin
  if p_email is null or char_length(btrim(p_email)) > 120 or btrim(p_email) !~* '^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$' then raise exception 'bad_email'; end if;
  if v_hash is not null and (select count(*) from public.launch_signups where ip_hash = v_hash) >= 8 then raise exception 'too_many'; end if;
  if (select count(*) from public.launch_signups) >= 200000 then raise exception 'full'; end if;
  insert into public.launch_signups as l (email, phone_os, lang, source, ip_hash)
  values (lower(btrim(p_email)), case when p_phone_os in ('android', 'iphone') then p_phone_os end,
          nullif(left(coalesce(p_lang, ''), 12), ''), nullif(left(coalesce(p_source, ''), 40), ''), v_hash)
  on conflict (lower(email)) do update set phone_os = coalesce(excluded.phone_os, l.phone_os);
end $$;

create or replace function public.leave_launch_list(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from public.launch_signups where lower(email) = lower(btrim(coalesce(p_email, '')));
end $$;

revoke all on function public.join_launch_list(text, text, text, text) from public;
revoke all on function public.leave_launch_list(text) from public;
grant execute on function public.join_launch_list(text, text, text, text) to anon, authenticated;
grant execute on function public.leave_launch_list(text) to anon, authenticated;
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

-- El administrador se agrega a mano, una vez:  insert into public.app_admins (user_id) values ('<id de la cuenta>');
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

-- ===== pro_por_tester.sql =====
-- Plan Pro por persona con acceso: quien administra decide si lo recibe y por cuánto tiempo.
alter table public.access_grants add column if not exists pro_forever boolean not null default false;
alter table public.access_grants add column if not exists pro_until timestamptz;

-- El acceso (entrar a la app) y el plan Pro quedan separados: el Pro sale de pro_forever / pro_until.
create or replace function public.apply_access(p_email text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); u uuid; g record;
begin
  select x.pro_forever, x.pro_until into g from public.access_grants x where x.email = v_email and x.status = 'active';
  if not found then return false; end if;
  select x.id into u from auth.users x where lower(x.email) = v_email and x.email_confirmed_at is not null limit 1;
  if u is null then return false; end if;
  if g.pro_forever or (g.pro_until is not null and g.pro_until > now()) then
    insert into public.entitlements as e (user_id, plan, status, source, period_end, trial_used)
    values (u, 'pro', 'active', 'manual', case when g.pro_forever then null else g.pro_until end, true)
    on conflict (user_id) do update
      set status = 'active', source = 'manual', period_end = excluded.period_end, updated_at = now()
      where e.plan = 'pro' and not (e.source in ('web', 'play') and e.status in ('active', 'grace'));
  else
    update public.entitlements e set status = 'expired', updated_at = now()
    where e.user_id = u and e.source in ('founder', 'manual') and e.status <> 'expired';
  end if;
  update public.access_grants x set applied_at = coalesce(x.applied_at, now()) where x.email = v_email;
  return true;
end $$;

-- p_days: 0 quita el Pro, -1 lo deja sin vencimiento, N lo da por N días desde ahora.
create or replace function public.admin_set_pro(p_email text, p_days int) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, ''))); v_until timestamptz;
begin
  perform public.admin_guard();
  if p_days is null or p_days < -1 or p_days > 730 then raise exception 'bad_days'; end if;
  v_until := case when p_days > 0 then now() + make_interval(days => p_days) else null end;
  update public.access_grants x set pro_forever = (p_days = -1), pro_until = v_until where x.email = v_email and x.status = 'active';
  if not found then raise exception 'not_found'; end if;
  perform public.apply_access(v_email);
  insert into public.admin_log (admin_id, action, target, detail)
  values ((select auth.uid()), 'plan_pro', v_email, case when p_days = 0 then 'sin Pro' when p_days = -1 then 'Pro sin vencimiento' else 'Pro por ' || p_days || ' días' end);
  return jsonb_build_object('email', v_email, 'pro_forever', p_days = -1, 'pro_until', v_until);
end $$;

create or replace function public.admin_revoke_access(p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  perform public.admin_guard();
  update public.access_grants g set status = 'revoked', revoked_at = now(), applied_at = null, pro_forever = false, pro_until = null where g.email = v_email;
  if not found then raise exception 'not_found'; end if;
  update public.entitlements e set status = 'expired', updated_at = now()
  where e.source in ('founder', 'manual') and e.user_id in (select u.id from auth.users u where lower(u.email) = v_email);
  insert into public.admin_log (admin_id, action, target) values ((select auth.uid()), 'quitar_acceso', v_email);
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
        select g.email, g.kind, g.status, g.note, g.granted_at, g.applied_at, g.revoked_at, g.invited_at, g.pro_forever, g.pro_until,
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

revoke all on function public.admin_set_pro(text, int) from public, anon;
grant execute on function public.admin_set_pro(text, int) to authenticated;

-- ===== prueba_siete_dias.sql =====
-- Prueba sin medio de pago: 7 días. Al suscribirse con medio de pago: 21 días gratis menos los ya usados (lo aplica la función de pagos).
create or replace function public.start_trial() returns public.entitlements
language plpgsql security definer set search_path = '' as $$
declare
  cfg jsonb; days int; r public.entitlements; uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select value into cfg from public.app_flags where key = 'billing';
  if not coalesce((cfg->>'enabled')::boolean, false) then raise exception 'billing_disabled'; end if;
  days := least(greatest(coalesce((cfg->>'trial_days')::int, 7), 1), 60);
  insert into public.entitlements (user_id, plan, status, source, period_end, trial_used)
  values (uid, 'pro', 'trialing', 'trial', now() + make_interval(days => days), true)
  on conflict (user_id) do nothing
  returning * into r;
  if r.user_id is null then select * into r from public.entitlements where user_id = uid; end if;
  return r;
end $$;
update public.app_flags set value = value || jsonb_build_object('trial_days', 7, 'card_trial_days', 21), updated_at = now() where key = 'billing';

-- ───── Panel: configuración de planes (migración panel_planes) ─────
-- Panel: configurar los planes (límites del plan gratis, funciones solo Pro, días de prueba y precios).
-- No enciende ni apaga el cobro: `enabled`, `preview` y `checkout` no se tocan desde aquí.
create or replace function public.admin_set_plans(p_cfg jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  cur jsonb; nuevo jsonb := '{}'::jsonb; k text; n numeric; feats jsonb; precios jsonb; moneda text; periodo text;
  conocidas constant text[] := array['supersets', 'techniques', 'suggestions', 'templates', 'warmup', 'recovery', 'assistant'];
  enteros constant jsonb := '{"free_routines":[1,50],"free_history_days":[7,3650],"free_custom_exercises":[0,500],"trial_days":[1,60],"card_trial_days":[0,60]}'::jsonb;
begin
  perform public.admin_guard();
  if p_cfg is null or jsonb_typeof(p_cfg) <> 'object' then raise exception 'bad_plans'; end if;
  select value into cur from public.app_flags where key = 'billing' for update;
  if cur is null then raise exception 'bad_plans'; end if;

  for k in select jsonb_object_keys(enteros) loop
    if p_cfg ? k then
      if jsonb_typeof(p_cfg -> k) <> 'number' then raise exception 'bad_plans'; end if;
      n := (p_cfg ->> k)::numeric;
      if n <> trunc(n) or n < (enteros -> k ->> 0)::numeric or n > (enteros -> k ->> 1)::numeric then raise exception 'bad_plans'; end if;
      nuevo := nuevo || jsonb_build_object(k, n::int);
    end if;
  end loop;

  if p_cfg ? 'pro_only' then
    if jsonb_typeof(p_cfg -> 'pro_only') <> 'array' then raise exception 'bad_plans'; end if;
    select coalesce(jsonb_agg(f order by array_position(conocidas, f)), '[]'::jsonb) into feats
    from (select distinct x as f from jsonb_array_elements_text(p_cfg -> 'pro_only') x) t where f = any (conocidas);
    if jsonb_array_length(feats) <> (select count(distinct x) from jsonb_array_elements_text(p_cfg -> 'pro_only') x) then raise exception 'bad_plans'; end if;
    nuevo := nuevo || jsonb_build_object('pro_only', feats);
  end if;

  if p_cfg ? 'prices' then
    precios := coalesce(cur -> 'prices', '{}'::jsonb);
    foreach moneda in array array['CLP', 'USD'] loop
      if p_cfg -> 'prices' ? moneda then
        foreach periodo in array array['monthly', 'yearly'] loop
          if jsonb_typeof(p_cfg -> 'prices' -> moneda -> periodo) is distinct from 'number' then raise exception 'bad_plans'; end if;
          n := (p_cfg -> 'prices' -> moneda ->> periodo)::numeric;
          if n <= 0 or n > 10000000 or (moneda = 'CLP' and n <> trunc(n)) then raise exception 'bad_plans'; end if;
        end loop;
        precios := precios || jsonb_build_object(moneda, jsonb_build_object(
          'monthly', (p_cfg -> 'prices' -> moneda -> 'monthly'), 'yearly', (p_cfg -> 'prices' -> moneda -> 'yearly')));
      end if;
    end loop;
    nuevo := nuevo || jsonb_build_object('prices', precios);
  end if;

  if nuevo = '{}'::jsonb then raise exception 'bad_plans'; end if;
  update public.app_flags set value = cur || nuevo, updated_at = now() where key = 'billing';
  insert into public.admin_log (admin_id, action, detail) values ((select auth.uid()), 'planes', left(nuevo::text, 500));
  return cur || nuevo;
end $$;
revoke all on function public.admin_set_plans(jsonb) from public, anon;
grant execute on function public.admin_set_plans(jsonb) to authenticated;

-- Series de calentamiento (migración series_calentamiento)
alter table public.set_logs add column if not exists warmup boolean not null default false;
