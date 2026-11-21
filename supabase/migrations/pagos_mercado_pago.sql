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
