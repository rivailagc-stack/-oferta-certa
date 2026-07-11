alter table public.products add column if not exists affiliate_link text;
alter table public.products add column if not exists image_url text;
alter table public.products add column if not exists image_urls text[] default '{}';
alter table public.products add column if not exists marketplace text;
alter table public.products add column if not exists featured boolean default false;
alter table public.products add column if not exists active boolean default true;
alter table public.products add column if not exists category text;

update public.products
set image_urls=array[image_url]
where image_url is not null
and (image_urls is null or cardinality(image_urls)=0);

notify pgrst,'reload schema';
