alter table public.products add column if not exists clicks bigint default 0;
update public.products set clicks=0 where clicks is null;
notify pgrst,'reload schema';
