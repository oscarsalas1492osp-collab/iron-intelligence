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
