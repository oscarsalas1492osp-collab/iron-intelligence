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
