-- Series de calentamiento: quedan anotadas, pero no cuentan en volumen, récords ni recomendación de carga.
alter table public.set_logs add column if not exists warmup boolean not null default false;
