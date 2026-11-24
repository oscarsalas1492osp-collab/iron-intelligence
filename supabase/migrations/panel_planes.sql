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
