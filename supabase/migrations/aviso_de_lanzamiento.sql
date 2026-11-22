-- Lista de aviso de lanzamiento (página pública): quien deja su correo recibe un aviso cuando la app salga.
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
