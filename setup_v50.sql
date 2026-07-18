-- OFERTA CERTA V50 - execute uma vez no Supabase SQL Editor
alter table public.products add column if not exists colors jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists sizes jsonb not null default '[]'::jsonb;
alter table public.products add column if not exists product_type text not null default 'affiliate';
alter table public.products add column if not exists stock integer not null default 0;
alter table public.products add column if not exists package_weight numeric;
alter table public.products add column if not exists package_length integer;
alter table public.products add column if not exists package_width integer;
alter table public.products add column if not exists package_height integer;
alter table public.products add column if not exists flash_sale boolean not null default false;
alter table public.products add column if not exists flash_sale_end_at timestamptz;
notify pgrst, 'reload schema';
