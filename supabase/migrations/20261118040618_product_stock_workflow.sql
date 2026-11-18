begin;

alter table public.inventory_movements
  add column product_id uuid,
  add column product_quantity_delta numeric(12,3),
  add column stock_before numeric(12,3),
  add column stock_after numeric(12,3),
  add column stock_kind text check (stock_kind in ('in','out','adjust','sale','restore')),
  add column request_id uuid unique,
  add foreign key (product_id, business_unit_id) references public.products(id, business_unit_id);
create index inventory_movements_product on public.inventory_movements(product_id, event_id, created_at desc);

-- All consumption paths share one locked balance check, including item edits.
create function private.guard_stock_movement() returns trigger
language plpgsql security definer set search_path = '' as $$
declare stock public.event_inventory; balance numeric; rate numeric;
begin
  select * into stock from public.event_inventory where id=new.event_inventory_id for update;
  select stock.stock_prepared + coalesce(sum(quantity_delta),0) into balance
    from public.inventory_movements where event_inventory_id=stock.id;
  if new.quantity_delta < 0 and balance + new.quantity_delta < 0 then
    raise exception 'app.insufficient_stock' using errcode='23514';
  end if;
  if new.order_item_id is not null then
    select i.product_id, s.quantity_per_unit into new.product_id, rate
    from public.order_items i join public.order_item_inventory s on s.order_item_id=i.id
    where i.id=new.order_item_id and s.event_inventory_id=stock.id;
    new.product_quantity_delta := new.quantity_delta / rate;
    new.stock_kind := case when new.quantity_delta > 0 then 'restore' else 'sale' end;
  elsif new.product_quantity_delta <> 0 then
    rate := new.quantity_delta / new.product_quantity_delta;
  end if;
  if rate > 0 then
    new.stock_before := floor(balance / rate);
    new.stock_after := floor((balance + new.quantity_delta) / rate);
  end if;
  return new;
end;
$$;
create trigger guard_stock_movement before insert on public.inventory_movements
for each row execute function private.guard_stock_movement();
revoke all on function private.guard_stock_movement() from public, anon, authenticated;

-- Only quantities needed at the counter are exposed to Staff; material details stay Owner-only.
create function private.get_product_stock(p_event uuid)
returns table(product_id uuid, stock_remaining numeric, low_stock_threshold numeric, editable boolean)
language plpgsql stable security definer set search_path = '' as $$
declare unit_id uuid;
begin
  select business_unit_id into unit_id from public.events where id=p_event;
  if not found then raise exception 'app.not_found' using errcode='P0002'; end if;
  perform private.require_member(unit_id);
  return query
  with balances as (
    select e.id, e.stock_prepared + coalesce(sum(m.quantity_delta),0) as remaining, e.low_stock_threshold
    from public.event_inventory e left join public.inventory_movements m on m.event_inventory_id=e.id
    where e.event_id=p_event group by e.id
  )
  select p.id, min(floor(b.remaining / l.quantity_per_unit)),
    coalesce(max(ceil(b.low_stock_threshold / l.quantity_per_unit)),0),
    count(l.id) <= 1 and not exists (
      select 1 from public.product_inventory_links other_link
      where other_link.event_id=p_event and other_link.active and other_link.product_id<>p.id
        and other_link.event_inventory_id in (
          select self_link.event_inventory_id from public.product_inventory_links self_link
          where self_link.event_id=p_event and self_link.product_id=p.id and self_link.active
        )
    )
  from public.products p join public.event_products ep on ep.product_id=p.id and ep.event_id=p_event and ep.active
  left join public.product_inventory_links l on l.product_id=p.id and l.event_id=p_event and l.active
  left join balances b on b.id=l.event_inventory_id
  where p.business_unit_id=unit_id
  group by p.id;
end;
$$;
create function public.get_product_stock(p_event uuid)
returns table(product_id uuid, stock_remaining numeric, low_stock_threshold numeric, editable boolean)
language sql stable security invoker set search_path = '' as $$
  select * from private.get_product_stock(p_event);
$$;

create function private.change_product_stock(p_event uuid, p_product uuid, p_kind text, p_quantity numeric,
  p_reason text, p_threshold numeric, p_expected numeric, p_request uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare event_row public.events; product_row public.products; link public.product_inventory_links;
  stock public.event_inventory; balance numeric; units numeric; delta numeric; item_id uuid;
  prior public.inventory_movements;
begin
  select * into event_row from public.events where id=p_event for update;
  if not found then raise exception 'app.not_found' using errcode='P0002'; end if;
  perform private.require_owner(event_row.business_unit_id);
  select * into product_row from public.products where id=p_product and business_unit_id=event_row.business_unit_id for update;
  if not found or not exists(select 1 from public.event_products where event_id=p_event and product_id=p_product and active) then
    raise exception 'app.not_found' using errcode='P0002';
  end if;
  if p_kind is null or p_kind not in ('in','out','adjust') or p_request is null
    or p_quantity is null or p_quantity < 0 or p_quantity > 999999 or p_quantity <> trunc(p_quantity)
    or (p_kind <> 'adjust' and p_quantity=0)
    or p_threshold is null or p_threshold < 0 or p_threshold > 999999 or p_threshold <> trunc(p_threshold)
    or p_reason is null or length(btrim(p_reason)) not between 2 and 120 then
    raise exception 'app.invalid_request' using errcode='23514';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request::text,0));
  select * into prior from public.inventory_movements where request_id=p_request;
  if found then
    if prior.event_id<>p_event or prior.product_id<>p_product or prior.created_by<>auth.uid() then
      raise exception 'app.invalid_request' using errcode='23514';
    end if;
    return;
  end if;
  if not (select s.editable from private.get_product_stock(p_event) s where s.product_id=p_product) then
    raise exception 'app.inventory_shared' using errcode='23514';
  end if;
  select * into link from public.product_inventory_links where event_id=p_event and product_id=p_product and active;
  if not found then
    if p_expected is not null then raise exception 'app.stock_changed' using errcode='23514'; end if;
    insert into public.inventory_items(business_unit_id,name) values(event_row.business_unit_id,product_row.name) returning id into item_id;
    insert into public.event_inventory(business_unit_id,event_id,inventory_item_id,stock_prepared)
      values(event_row.business_unit_id,p_event,item_id,null) returning * into stock;
    insert into public.product_inventory_links(business_unit_id,event_id,product_id,event_inventory_id,quantity_per_unit)
      values(event_row.business_unit_id,p_event,p_product,stock.id,1) returning * into link;
  else
    select * into stock from public.event_inventory where id=link.event_inventory_id for update;
  end if;
  select stock.stock_prepared + coalesce(sum(quantity_delta),0) into balance
    from public.inventory_movements where event_inventory_id=stock.id;
  units := floor(balance/link.quantity_per_unit);
  if units is distinct from p_expected then raise exception 'app.stock_changed' using errcode='23514'; end if;
  if balance is null then
    if p_kind <> 'adjust' then raise exception 'app.stock_setup_required' using errcode='23514'; end if;
    update public.event_inventory set stock_prepared=0 where id=stock.id;
    select coalesce(sum(quantity_delta),0) into balance from public.inventory_movements where event_inventory_id=stock.id;
  end if;
  delta := case p_kind when 'in' then p_quantity*link.quantity_per_unit
    when 'out' then -p_quantity*link.quantity_per_unit else p_quantity*link.quantity_per_unit - balance end;
  if balance+delta < 0 then raise exception 'app.insufficient_stock' using errcode='23514'; end if;
  if balance+delta > 999999999 then raise exception 'app.invalid_request' using errcode='23514'; end if;
  if p_threshold*link.quantity_per_unit > 999999999 then raise exception 'app.invalid_request' using errcode='23514'; end if;
  update public.event_inventory set low_stock_threshold=p_threshold*link.quantity_per_unit where id=stock.id;
  if delta <> 0 then
    insert into public.inventory_movements(business_unit_id,event_id,event_inventory_id,quantity_delta,reason,note,created_by,
      product_id,product_quantity_delta,stock_kind,request_id)
    values(event_row.business_unit_id,p_event,stock.id,delta,'manual_adjustment',btrim(p_reason),auth.uid(),
      p_product,delta/link.quantity_per_unit,p_kind,p_request);
  end if;
end;
$$;
create function public.change_product_stock(p_event uuid, p_product uuid, p_kind text, p_quantity numeric,
  p_reason text, p_threshold numeric, p_expected numeric, p_request uuid) returns void
language sql security invoker set search_path = '' as $$
  select private.change_product_stock(p_event,p_product,p_kind,p_quantity,p_reason,p_threshold,p_expected,p_request);
$$;

revoke all on function private.get_product_stock(uuid), public.get_product_stock(uuid),
  private.change_product_stock(uuid,uuid,text,numeric,text,numeric,numeric,uuid),
  public.change_product_stock(uuid,uuid,text,numeric,text,numeric,numeric,uuid) from public, anon, authenticated;
grant execute on function private.get_product_stock(uuid), public.get_product_stock(uuid),
  private.change_product_stock(uuid,uuid,text,numeric,text,numeric,numeric,uuid),
  public.change_product_stock(uuid,uuid,text,numeric,text,numeric,numeric,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;
