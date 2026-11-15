-- Receipt prices are operational data; costs and reports keep their Owner policies.
create function private.get_order_receipt_prices(p_order_id uuid)
returns table (order_item_id uuid, unit_price_vnd bigint)
language plpgsql stable security definer set search_path = '' as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id and deleted_at is null;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(order_row.business_unit_id);

  return query
  select i.id, f.unit_price_vnd
  from public.order_items i
  join public.order_item_financials f on f.order_item_id = i.id
    and f.business_unit_id = i.business_unit_id
  where i.order_id = order_row.id and i.business_unit_id = order_row.business_unit_id
    and i.voided_at is null
  order by i.created_at, i.id;
end;
$$;

create function public.get_order_receipt_prices(p_order_id uuid)
returns table (order_item_id uuid, unit_price_vnd bigint)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_order_receipt_prices(p_order_id);
$$;

revoke all on function private.get_order_receipt_prices(uuid) from public, anon, authenticated;
revoke all on function public.get_order_receipt_prices(uuid) from public, anon, authenticated;
grant execute on function private.get_order_receipt_prices(uuid) to authenticated;
grant execute on function public.get_order_receipt_prices(uuid) to authenticated;

notify pgrst, 'reload schema';
