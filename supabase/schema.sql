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
