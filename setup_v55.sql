-- OFERTA CERTA V55 — CHECKOUT INTERNO
-- Execute uma vez no Supabase SQL Editor.

alter table public.orders
add column if not exists customer jsonb;

alter table public.orders
add column if not exists payment_method text;

alter table public.orders
add column if not exists payment_status_detail text;

alter table public.orders
add column if not exists stock_updated boolean not null default false;

create or replace function public.confirm_paid_order(
  p_order_id uuid,
  p_payment_id text,
  p_payer_email text,
  p_payment_method text,
  p_status_detail text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
  v_item jsonb;
  v_quantity integer;
begin
  select *
  into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'Pedido não encontrado';
  end if;

  update public.orders
  set status = 'approved',
      payment_id = coalesce(p_payment_id, payment_id),
      payer_email = coalesce(p_payer_email, payer_email),
      customer_email = coalesce(p_payer_email, customer_email),
      payment_method = coalesce(p_payment_method, payment_method),
      payment_status_detail = coalesce(p_status_detail, payment_status_detail),
      updated_at = now()
  where id = p_order_id;

  if coalesce(v_order.stock_updated, false) then
    return;
  end if;

  for v_item in
    select value from jsonb_array_elements(coalesce(v_order.items, '[]'::jsonb))
  loop
    v_quantity := greatest(1, coalesce((v_item->>'quantity')::integer, 1));

    update public.products
    set stock = greatest(0, stock - v_quantity)
    where id::text = v_item->>'id'
      and product_type = 'own';
  end loop;

  update public.orders
  set stock_updated = true,
      updated_at = now()
  where id = p_order_id;
end;
$$;

revoke all on function public.confirm_paid_order(uuid, text, text, text, text) from public;
grant execute on function public.confirm_paid_order(uuid, text, text, text, text) to service_role;

notify pgrst, 'reload schema';
