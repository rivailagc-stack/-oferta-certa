-- OFERTA CERTA V44
-- Execute uma vez no Supabase SQL Editor.

alter table public.products
add column if not exists flash_sale boolean not null default false;

alter table public.products
add column if not exists flash_sale_end_at timestamptz;

notify pgrst, 'reload schema';
