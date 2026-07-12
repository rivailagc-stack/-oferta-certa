-- OFERTA CERTA V24 - LOJA HÍBRIDA
-- Execute no Supabase SQL Editor.

alter table public.products
add column if not exists product_type text default 'affiliate'
check (product_type in ('affiliate','own'));

alter table public.products
add column if not exists stock integer default 0
check (stock >= 0);

alter table public.products
add column if not exists shipping_price numeric(10,2) default 0
check (shipping_price >= 0);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'pending',
  total numeric(12,2) not null default 0,
  shipping_total numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  preference_id text,
  payment_id text,
  customer_email text,
  payer_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orders enable row level security;

-- Pedidos NÃO ficam públicos. Somente as funções da Vercel,
-- usando a service role, poderão criar e atualizar pedidos.

notify pgrst, 'reload schema';
