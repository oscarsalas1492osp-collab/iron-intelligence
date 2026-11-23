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
