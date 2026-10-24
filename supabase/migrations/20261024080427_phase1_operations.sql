begin;

create function public.get_access_context() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'name', b.name, 'slug', b.slug, 'role', private.role_for_unit(b.id)
  ) order by b.name), '[]'::jsonb)
  from public.business_units b where private.is_member(b.id);
$$;

create function private.create_event(p_unit uuid, p_name text, p_date date, p_capacity integer, p_prefix text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare event_id uuid;
begin
  perform private.require_owner(p_unit);
  insert into public.events(business_unit_id, name, event_date, capacity, ticket_prefix, status)
  values(p_unit, btrim(p_name), p_date, p_capacity, upper(btrim(p_prefix)), 'active') returning id into event_id;
  insert into public.event_products(business_unit_id, event_id, product_id)
  select p_unit, event_id, id from public.products where business_unit_id = p_unit and active;
  insert into public.event_inventory(business_unit_id, event_id, inventory_item_id)
  select p_unit, event_id, id from public.inventory_items where business_unit_id = p_unit and active;
  return event_id;
end;
$$;
create function public.create_event(p_unit uuid, p_name text, p_date date, p_capacity integer, p_prefix text)
returns uuid language sql security invoker set search_path = '' as $$
  select private.create_event(p_unit, p_name, p_date, p_capacity, p_prefix);
$$;

create function private.save_product(p_unit uuid, p_product_id uuid, p_category uuid, p_sku text,
  p_name text, p_price bigint, p_cost bigint, p_active boolean) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_product_id uuid;
begin
  perform private.require_owner(p_unit);
  if p_product_id is null then
    insert into public.products(business_unit_id, category_id, sku, name, price_vnd, active)
    values(p_unit, p_category, upper(btrim(p_sku)), btrim(p_name), p_price, p_active) returning id into v_product_id;
    insert into public.event_products(business_unit_id, event_id, product_id)
    select p_unit, e.id, v_product_id from public.events e
    where e.business_unit_id = p_unit and e.status in ('planned', 'active');
  else
    update public.products set category_id = p_category, sku = upper(btrim(p_sku)), name = btrim(p_name),
      price_vnd = p_price, active = p_active where id = p_product_id and business_unit_id = p_unit
    returning id into v_product_id;
    if v_product_id is null then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  end if;
  insert into public.product_costs(business_unit_id, product_id, unit_cost_vnd)
  values(p_unit, v_product_id, p_cost)
  on conflict (product_id) do update set unit_cost_vnd = excluded.unit_cost_vnd;
  return v_product_id;
end;
$$;
create function public.save_product(p_unit uuid, p_product_id uuid, p_category uuid, p_sku text,
  p_name text, p_price bigint, p_cost bigint, p_active boolean) returns uuid
language sql security invoker set search_path = '' as $$
  select private.save_product(p_unit, p_product_id, p_category, p_sku, p_name, p_price, p_cost, p_active);
$$;

create function private.sync_ticket() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into public.ticket_transitions(business_unit_id, event_id, ticket_id, from_status, to_status, changed_by)
    values(new.business_unit_id, new.event_id, new.id,
      case when tg_op = 'UPDATE' then old.status else null end, new.status, auth.uid());
  end if;
  insert into public.queue_entries(business_unit_id, event_id, ticket_id, ticket_number,
    display_name, status, sequence_number, status_changed_at)
  values(new.business_unit_id, new.event_id, new.id, new.ticket_number,
    new.customer_name, new.status, new.sequence_number, now())
  on conflict (ticket_id) do update set display_name = excluded.display_name,
    status = excluded.status,
    status_changed_at = case when public.queue_entries.status is distinct from excluded.status
      then now() else public.queue_entries.status_changed_at end;
  return new;
end;
$$;
create trigger sync_ticket after insert or update on public.tickets
for each row execute function private.sync_ticket();

create function private.snapshot_order_item() returns trigger
language plpgsql security definer set search_path = '' as $$
declare product_row public.products; category_code text;
begin
  select * into product_row from public.products where id = new.product_id and business_unit_id = new.business_unit_id for update;
  if not found or not product_row.active or not exists (
    select 1 from public.event_products where event_id = new.event_id and product_id = new.product_id and active
  ) then raise exception 'app.product_unavailable' using errcode = '23514'; end if;
  select code into category_code from public.product_categories where id = product_row.category_id;
  new.sku_snapshot := product_row.sku;
  new.name_snapshot := product_row.name;
  new.category_code_snapshot := category_code;
  update public.products set sold_at = coalesce(sold_at, now()) where id = product_row.id;
  return new;
end;
$$;
create trigger snapshot_order_item before insert on public.order_items
for each row execute function private.snapshot_order_item();

create function private.sync_item_stock(p_item_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare item_row public.order_items; order_row public.orders; stock_row public.order_item_inventory;
  target_quantity numeric; movement_delta numeric;
begin
  select * into item_row from public.order_items where id = p_item_id;
  select * into order_row from public.orders where id = item_row.order_id for update;
  for stock_row in select * from public.order_item_inventory where order_item_id = p_item_id
    order by event_inventory_id for update loop
    target_quantity := case when order_row.payment_status = 'cancelled' or order_row.deleted_at is not null
      or item_row.voided_at is not null then 0 else item_row.quantity * stock_row.quantity_per_unit end;
    movement_delta := stock_row.applied_quantity - target_quantity;
    if movement_delta <> 0 then
      perform 1 from public.event_inventory where id = stock_row.event_inventory_id for update;
      insert into public.inventory_movements(business_unit_id, event_id, event_inventory_id,
        order_item_id, quantity_delta, reason, created_by)
      values(item_row.business_unit_id, item_row.event_id, stock_row.event_inventory_id,
        p_item_id, movement_delta, case when stock_row.applied_quantity = 0 and movement_delta < 0 then 'sale' else 'order_adjustment' end,
        auth.uid());
      update public.order_item_inventory set applied_quantity = target_quantity where id = stock_row.id;
    end if;
  end loop;
end;
$$;

create function private.finish_order_item() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.order_item_financials(business_unit_id, event_id, order_item_id, unit_price_vnd, unit_cost_vnd)
  select new.business_unit_id, new.event_id, new.id, p.price_vnd, c.unit_cost_vnd
  from public.products p left join public.product_costs c on c.product_id = p.id where p.id = new.product_id;
  insert into public.order_item_inventory(business_unit_id, event_id, order_item_id, event_inventory_id, quantity_per_unit)
  select new.business_unit_id, new.event_id, new.id, l.event_inventory_id, l.quantity_per_unit
  from public.product_inventory_links l where l.product_id = new.product_id and l.event_id = new.event_id and l.active;
  perform private.sync_item_stock(new.id);
  return new;
end;
$$;
create trigger finish_order_item after insert on public.order_items
for each row execute function private.finish_order_item();

create function private.sync_updated_item_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform private.sync_item_stock(new.id);
  return new;
end;
$$;
create trigger sync_updated_item_stock after update of quantity, voided_at on public.order_items
for each row execute function private.sync_updated_item_stock();

create function private.sync_order_stock() returns trigger
language plpgsql security definer set search_path = '' as $$
declare item_id uuid;
begin
  for item_id in select id from public.order_items where order_id = new.id order by id loop
    perform private.sync_item_stock(item_id);
  end loop;
  return new;
end;
$$;
create trigger sync_order_stock after update of payment_status, deleted_at on public.orders
for each row execute function private.sync_order_stock();

-- For the counter response only: this function is not granted as an API.
create function private.order_result(p_order_id uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('order_id', o.id, 'ticket_id', o.ticket_id, 'ticket_number', t.ticket_number,
    'total_vnd', coalesce((select sum(i.quantity * f.unit_price_vnd) from public.order_items i
      join public.order_item_financials f on f.order_item_id = i.id
      where i.order_id = o.id and i.voided_at is null), 0))
  from public.orders o left join public.tickets t on t.id = o.ticket_id where o.id = p_order_id;
$$;

create function private.create_order(p_event uuid, p_request_id uuid, p_items jsonb,
  p_register_ticket boolean, p_customer_name text, p_phone_zalo text, p_ticket_id uuid,
  p_paid boolean, p_method public.payment_method) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare event_row public.events; existing_order public.orders; order_id uuid; ticket_id uuid := p_ticket_id;
  next_number integer; item jsonb; product_id uuid;
begin
  select * into event_row from public.events where id = p_event for update;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(event_row.business_unit_id);
  if p_request_id is null then raise exception 'app.invalid_request' using errcode = '23514'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_request_id::text, 0));
  select * into existing_order from public.orders where request_id = p_request_id;
  if found then
    if existing_order.event_id <> p_event or existing_order.created_by <> auth.uid() then
      raise exception 'app.invalid_request' using errcode = '23514';
    end if;
    -- Do not expose a historical paid ledger through the idempotency endpoint.
    return jsonb_build_object('order_id', existing_order.id, 'ticket_id', existing_order.ticket_id, 'already_created', true);
  end if;
  if event_row.status <> 'active' then raise exception 'app.event_not_active' using errcode = '23514'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'app.items_required' using errcode = '23514';
  end if;
  if p_paid and p_method is null then raise exception 'app.payment_method_required' using errcode = '23514'; end if;
  if p_register_ticket then
    if p_ticket_id is not null or p_customer_name is null or length(btrim(p_customer_name)) = 0 then
      raise exception 'app.customer_name_required' using errcode = '23514';
    end if;
    select * into event_row from public.events where id = p_event for update;
    if event_row.capacity is not null and (select count(*) from public.tickets
      where event_id = p_event and status <> 'cancelled') >= event_row.capacity then
      raise exception 'app.event_full' using errcode = '23514';
    end if;
    next_number := event_row.next_ticket_number;
    update public.events set next_ticket_number = next_ticket_number + 1 where id = p_event;
    insert into public.tickets(business_unit_id, event_id, ticket_number, sequence_number, customer_name, phone_zalo, created_by)
    values(event_row.business_unit_id, p_event,
      event_row.ticket_prefix || '-' || lpad(next_number::text, greatest(3, length(next_number::text)), '0'),
      next_number, btrim(p_customer_name), nullif(btrim(p_phone_zalo), ''), auth.uid()) returning id into ticket_id;
  elsif ticket_id is not null and not exists (
    select 1 from public.tickets where id = ticket_id and event_id = p_event and status <> 'cancelled'
  ) then raise exception 'app.invalid_ticket' using errcode = '23514'; end if;
  insert into public.orders(business_unit_id, event_id, ticket_id, request_id, created_by, payment_status, payment_method, paid_at)
  values(event_row.business_unit_id, p_event, ticket_id, p_request_id, auth.uid(),
    case when p_paid then 'paid'::public.payment_status else 'unpaid'::public.payment_status end,
    p_method, case when p_paid then now() else null end) returning id into order_id;
  -- Stable product ordering prevents deadlocks when two staff sell overlapping baskets.
  for item in select value from jsonb_array_elements(p_items) order by value->>'product_id' loop
    product_id := (item->>'product_id')::uuid;
    perform 1 from public.products where id=product_id for update;
    if item ? 'expected_price_vnd' and (item->>'expected_price_vnd')::bigint is distinct from (
      select price_vnd from public.products where id=product_id and business_unit_id=event_row.business_unit_id
    ) then raise exception 'app.price_changed' using errcode='23514'; end if;
    insert into public.order_items(business_unit_id, event_id, order_id, product_id,
      sku_snapshot, name_snapshot, category_code_snapshot, quantity, options)
    values(event_row.business_unit_id, p_event, order_id, product_id, '', '', '',
      (item->>'quantity')::integer, coalesce(item->'options', '{}'::jsonb));
  end loop;
  return private.order_result(order_id);
end;
$$;
create function public.create_order(p_event uuid, p_request_id uuid, p_items jsonb,
  p_register_ticket boolean default false, p_customer_name text default null, p_phone_zalo text default null,
  p_ticket_id uuid default null, p_paid boolean default false, p_method public.payment_method default null)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.create_order(p_event, p_request_id, p_items, p_register_ticket, p_customer_name,
    p_phone_zalo, p_ticket_id, p_paid, p_method);
$$;

create function private.set_ticket_status(p_ticket_id uuid, p_status public.ticket_status) returns void
language plpgsql security definer set search_path = '' as $$
declare ticket_row public.tickets; expected_status public.ticket_status;
begin
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(ticket_row.business_unit_id);
  if p_status = ticket_row.status then return; end if;
  expected_status := case ticket_row.status when 'ticket_printed' then 'waiting'::public.ticket_status
    when 'waiting' then 'in_progress'::public.ticket_status when 'in_progress' then 'completed'::public.ticket_status else null end;
  if (p_status = 'cancelled' and ticket_row.status not in ('cancelled', 'completed'))
    or (expected_status is not null and p_status = expected_status) then
    update public.tickets set status = p_status where id = p_ticket_id;
  else raise exception 'app.invalid_transition' using errcode = '23514'; end if;
end;
$$;
create function public.set_ticket_status(p_ticket_id uuid, p_status public.ticket_status) returns void
language sql security invoker set search_path = '' as $$ select private.set_ticket_status(p_ticket_id, p_status); $$;

create function private.record_ticket_print(p_ticket_id uuid) returns integer
language plpgsql security definer set search_path = '' as $$
declare ticket_row public.tickets; print_count integer;
begin
  select * into ticket_row from public.tickets where id = p_ticket_id for update;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(ticket_row.business_unit_id);
  if ticket_row.status = 'cancelled' then raise exception 'app.invalid_transition' using errcode = '23514'; end if;
  update public.tickets set print_count = public.tickets.print_count + 1,
    status = case when status = 'registered' then 'ticket_printed'::public.ticket_status else status end
  where id = p_ticket_id returning public.tickets.print_count into print_count;
  return print_count;
end;
$$;
create function public.record_ticket_print(p_ticket_id uuid) returns integer
language sql security invoker set search_path = '' as $$ select private.record_ticket_print(p_ticket_id); $$;

create function private.set_order_payment(p_order_id uuid, p_status public.payment_status, p_method public.payment_method)
returns void language plpgsql security definer set search_path = '' as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found or order_row.deleted_at is not null then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(order_row.business_unit_id);
  if p_status = order_row.payment_status then return; end if;
  if not ((order_row.payment_status = 'unpaid' and p_status in ('paid','cancelled'))
    or (order_row.payment_status = 'paid' and p_status = 'refunded')) then
    raise exception 'app.invalid_transition' using errcode = '23514';
  end if;
  if p_status = 'paid' and p_method is null then raise exception 'app.payment_method_required' using errcode = '23514'; end if;
  update public.orders set payment_status = p_status,
    payment_method = coalesce(p_method, payment_method),
    paid_at = case when p_status = 'paid' then now() else paid_at end where id = p_order_id;
end;
$$;
create function public.set_order_payment(p_order_id uuid, p_status public.payment_status, p_method public.payment_method default null)
returns void language sql security invoker set search_path = '' as $$
  select private.set_order_payment(p_order_id, p_status, p_method);
$$;

create function private.update_order_item(p_item_id uuid, p_quantity integer, p_options jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare item_row public.order_items; order_row public.orders;
begin
  select * into item_row from public.order_items where id = p_item_id;
  select * into order_row from public.orders where id = item_row.order_id for update;
  select * into item_row from public.order_items where id = p_item_id for update;
  if not found or item_row.voided_at is not null or order_row.deleted_at is not null then
    raise exception 'app.not_found' using errcode = 'P0002';
  end if;
  perform private.require_member(order_row.business_unit_id);
  if order_row.payment_status <> 'unpaid' then raise exception 'app.order_locked' using errcode = '23514'; end if;
  if p_quantity = 0 then
    if (select count(*) from public.order_items where order_id = order_row.id and voided_at is null) <= 1 then
      raise exception 'app.last_order_item' using errcode = '23514';
    end if;
    update public.order_items set voided_at = now() where id = p_item_id;
  else
    update public.order_items set quantity = p_quantity, options = p_options where id = p_item_id;
  end if;
end;
$$;
create function public.update_order_item(p_item_id uuid, p_quantity integer, p_options jsonb)
returns void language sql security invoker set search_path = '' as $$
  select private.update_order_item(p_item_id, p_quantity, p_options);
$$;

create function private.soft_delete_order(p_order_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id for update;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_owner(order_row.business_unit_id);
  if order_row.deleted_at is not null then return; end if;
  update public.orders set deleted_at = now() where id = p_order_id;
end;
$$;
create function public.soft_delete_order(p_order_id uuid) returns void
language sql security invoker set search_path = '' as $$ select private.soft_delete_order(p_order_id); $$;

-- Staff may retrieve an Unpaid checkout, never the paid financial history.
create function private.get_order_checkout(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare order_row public.orders;
begin
  select * into order_row from public.orders where id = p_order_id and deleted_at is null;
  if not found then raise exception 'app.not_found' using errcode = 'P0002'; end if;
  perform private.require_member(order_row.business_unit_id);
  if order_row.payment_status <> 'unpaid' and not private.is_owner(order_row.business_unit_id) then
    raise exception 'app.owner_required' using errcode = '42501';
  end if;
  return private.order_result(p_order_id);
end;
$$;
create function public.get_order_checkout(p_order_id uuid) returns jsonb
language sql security invoker set search_path = '' as $$ select private.get_order_checkout(p_order_id); $$;

create function private.save_inventory(p_unit uuid, p_event uuid, p_id uuid, p_name text,
  p_spec text, p_prepared numeric, p_threshold numeric) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_owner(p_unit);
  if not exists(select 1 from public.events where id=p_event and business_unit_id=p_unit) then
    raise exception 'app.not_found' using errcode='P0002';
  end if;
  if p_id is null then
    insert into public.inventory_items(business_unit_id,name,spec) values(p_unit,btrim(p_name),p_spec) returning id into v_id;
  else
    update public.inventory_items set name=btrim(p_name),spec=p_spec where id=p_id and business_unit_id=p_unit returning id into v_id;
    if v_id is null then raise exception 'app.not_found' using errcode='P0002'; end if;
  end if;
  insert into public.event_inventory(business_unit_id,event_id,inventory_item_id,stock_prepared,low_stock_threshold)
  values(p_unit,p_event,v_id,p_prepared,p_threshold)
  on conflict(event_id,inventory_item_id) do update set stock_prepared=excluded.stock_prepared,low_stock_threshold=excluded.low_stock_threshold;
  return v_id;
end;
$$;
create function public.save_inventory(p_unit uuid, p_event uuid, p_id uuid, p_name text,
  p_spec text, p_prepared numeric, p_threshold numeric) returns uuid
language sql security invoker set search_path = '' as $$
  select private.save_inventory(p_unit,p_event,p_id,p_name,p_spec,p_prepared,p_threshold);
$$;

-- API wrappers are invokers; privileged helpers are private and explicitly guarded.
revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.role_for_unit(uuid), private.is_member(uuid), private.is_owner(uuid),
  private.require_member(uuid), private.require_owner(uuid),
  private.create_event(uuid,text,date,integer,text),
  private.save_product(uuid,uuid,uuid,text,text,bigint,bigint,boolean),
  private.create_order(uuid,uuid,jsonb,boolean,text,text,uuid,boolean,public.payment_method),
  private.set_ticket_status(uuid,public.ticket_status), private.record_ticket_print(uuid),
  private.set_order_payment(uuid,public.payment_status,public.payment_method),
  private.update_order_item(uuid,integer,jsonb), private.soft_delete_order(uuid), private.get_order_checkout(uuid),
  private.save_inventory(uuid,uuid,uuid,text,text,numeric,numeric)
to authenticated;

do $$
declare func record;
begin
  for func in select p.oid::regprocedure as signature from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'get_access_context','create_event','save_product','create_order','set_ticket_status',
      'record_ticket_print','set_order_payment','update_order_item','soft_delete_order','get_order_checkout','save_inventory'
    ) loop
    execute format('revoke all on function %s from public, anon, authenticated', func.signature);
    execute format('grant execute on function %s to authenticated', func.signature);
  end loop;
end;
$$;

commit;
