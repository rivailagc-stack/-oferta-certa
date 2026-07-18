-- OFERTA CERTA V26 — FRETE AUTOMÁTICO
-- Execute uma vez no Supabase SQL Editor.

alter table public.products
add column if not exists package_weight numeric(10,3);

alter table public.products
add column if not exists package_length integer;

alter table public.products
add column if not exists package_width integer;

alter table public.products
add column if not exists package_height integer;

alter table public.orders
add column if not exists shipping_service_id integer;

alter table public.orders
add column if not exists shipping_service_name text;

alter table public.orders
add column if not exists shipping_postal_code text;

alter table public.orders
add column if not exists shipping_delivery_time integer;

notify pgrst, 'reload schema';
