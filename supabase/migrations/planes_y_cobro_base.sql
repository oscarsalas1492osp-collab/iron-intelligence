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
  'free_routines', 4,
  'free_history_days', 90,
  'prices', jsonb_build_object(
    'CLP', jsonb_build_object('monthly', 2990, 'yearly', 23990),
    'USD', jsonb_build_object('monthly', 2.99, 'yearly', 23.99)
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
