-- Dedicated fixtures; the runner rolls this transaction back.
reset role;
update public.staff_allowlist set active=true where email='staff@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'stock_event',to_jsonb(public.create_event(
  (select id from public.business_units where slug='workshop'),'Product stock QA','2026-11-18',null,'STOCK'));
insert into test_values select 'stock_product',to_jsonb(id) from public.products where sku='FB-OREO-025';

do $$
declare ev uuid := (select (value#>>'{}')::uuid from test_values where key='stock_event');
  pr uuid := (select (value#>>'{}')::uuid from test_values where key='stock_product');
  v_order uuid; initial_count bigint; movement_count bigint; stock_id uuid;
begin
  assert (select stock_remaining is null from public.get_product_stock(ev) where product_id=pr), 'Unconfigured stock is unknown';
  perform public.change_product_stock(ev,pr,'adjust',3,'Initial count',1,null,'90000000-0000-0000-0000-000000000001');
  assert (select stock_remaining=3 and low_stock_threshold=1 from public.get_product_stock(ev) where product_id=pr), 'Simple stock setup';
  perform public.change_product_stock(ev,pr,'adjust',3,'Initial count',1,null,'90000000-0000-0000-0000-000000000001');
  assert (select count(*)=1 from public.inventory_movements where request_id='90000000-0000-0000-0000-000000000001'), 'Retry applied once';
  v_order := (public.create_order(ev,'90000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',2)),false)->>'order_id')::uuid;
  assert (select stock_remaining=1 from public.get_product_stock(ev) where product_id=pr), 'Unpaid reserves stock';
  assert (select stock_before=3 and stock_after=1 and product_quantity_delta=-2 from public.inventory_movements where order_item_id in(select id from public.order_items where public.order_items.order_id=v_order)), 'Sale history in product units';
  perform public.set_order_payment(v_order,'paid','cash');
  assert (select stock_remaining=1 from public.get_product_stock(ev) where product_id=pr), 'Payment does not deduct again';
  perform public.set_order_payment(v_order,'refunded',null);
  assert (select stock_remaining=1 from public.get_product_stock(ev) where product_id=pr), 'Refund does not return consumed supplies';
  select count(*) into initial_count from public.orders;
  select count(*) into movement_count from public.inventory_movements;
  begin
    perform public.create_order(ev,'90000000-0000-0000-0000-000000000003',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',2)),true,'Rollback ticket');
    raise exception 'FAIL: oversell accepted';
  exception when check_violation then assert sqlerrm='app.insufficient_stock'; end;
  assert (select count(*)=initial_count from public.orders), 'Rejected checkout has no partial order';
  assert (select count(*)=movement_count from public.inventory_movements), 'Rejected checkout has no stock movement';
  assert not exists(select 1 from public.tickets where event_id=ev), 'Rejected checkout has no ticket';
  v_order := (public.create_order(ev,'90000000-0000-0000-0000-000000000004',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),false)->>'order_id')::uuid;
  perform public.set_order_payment(v_order,'cancelled',null);
  assert (select stock_remaining=1 from public.get_product_stock(ev) where product_id=pr), 'Cancellation restores once';
  begin
    perform public.change_product_stock(ev,pr,'in',1,'Stale edit',1,3,'90000000-0000-0000-0000-000000000005');
    raise exception 'FAIL: stale change accepted';
  exception when check_violation then assert sqlerrm='app.stock_changed'; end;
  perform public.change_product_stock(ev,pr,'in',2,'New delivery',1,1,'90000000-0000-0000-0000-000000000006');
  perform public.change_product_stock(ev,pr,'out',1,'Damaged item',1,3,'90000000-0000-0000-0000-000000000007');
  assert (select stock_remaining=2 from public.get_product_stock(ev) where product_id=pr), 'Stock in/out';
  begin
    perform public.change_product_stock(ev,pr,'out',3,'Too many',1,2,'90000000-0000-0000-0000-000000000008');
    raise exception 'FAIL: excessive stock out';
  exception when check_violation then assert sqlerrm='app.insufficient_stock'; end;
  begin
    perform public.change_product_stock(ev,pr,'in',1.5,'Fraction',1,2,'90000000-0000-0000-0000-000000000009');
    raise exception 'FAIL: fractional product stock';
  exception when check_violation then assert sqlerrm='app.invalid_request'; end;
  -- Existing exclusive recipes are displayed/edited in product units without rewriting their consumption snapshots.
  select event_inventory_id into stock_id from public.product_inventory_links where event_id=ev and product_id=pr;
  update public.product_inventory_links set quantity_per_unit=3 where event_id=ev and product_id=pr;
  assert (select stock_remaining=0 from public.get_product_stock(ev) where product_id=pr), 'Recipe conversion rounds down';
  perform public.change_product_stock(ev,pr,'adjust',3,'Physical count',1,0,'90000000-0000-0000-0000-000000000010');
  assert (select stock_remaining=3 from public.get_product_stock(ev) where product_id=pr), 'Recipe adjustment in sale units';
  assert (select quantity_per_unit=1 from public.order_item_inventory where order_item_id in(select id from public.order_items where public.order_items.order_id=v_order)), 'Old consumption snapshot preserved';
  -- Legacy negative balances remain visible and can be reconciled by physical count.
  update public.event_inventory set stock_prepared=null where id=stock_id;
  perform public.create_order(ev,'90000000-0000-0000-0000-000000000015',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',4)),false);
  update public.event_inventory set stock_prepared=0 where id=stock_id;
  assert (select stock_remaining=-1 from public.get_product_stock(ev) where product_id=pr), 'Legacy deficit is not hidden';
  perform public.change_product_stock(ev,pr,'adjust',3,'Reconcile physical stock',1,-1,'90000000-0000-0000-0000-000000000012');
  assert (select stock_remaining=3 from public.get_product_stock(ev) where product_id=pr), 'Legacy deficit reconciled explicitly';
  v_order := (public.create_order(ev,'90000000-0000-0000-0000-000000000013',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),false)->>'order_id')::uuid;
  begin
    perform public.update_order_item((select id from public.order_items where public.order_items.order_id=v_order),99,'{}');
    raise exception 'FAIL: item edit oversold';
  exception when check_violation then assert sqlerrm='app.insufficient_stock'; end;
  assert (select quantity=1 from public.order_items where public.order_items.order_id=v_order), 'Rejected edit rolls back';
  perform public.set_order_payment(v_order,'cancelled',null);
  insert into public.product_inventory_links(business_unit_id,event_id,product_id,event_inventory_id,quantity_per_unit)
    select business_unit_id,ev,id,stock_id,1 from public.products where sku='WS-TOTE-L-100';
  assert (select not editable from public.get_product_stock(ev) where product_id=pr), 'Shared recipe requires advanced editor';
  begin
    perform public.change_product_stock(ev,pr,'adjust',5,'Shared stock edit',1,3,'90000000-0000-0000-0000-000000000014');
    raise exception 'FAIL: shared material changed silently';
  exception when check_violation then assert sqlerrm='app.inventory_shared'; end;
  update public.product_inventory_links set active=false where event_id=ev and product_id<>pr;


end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test"}',true);
do $$
declare ev uuid := (select (value#>>'{}')::uuid from test_values where key='stock_event');
  pr uuid := (select (value#>>'{}')::uuid from test_values where key='stock_product');
begin
  assert (select stock_remaining=3 from public.get_product_stock(ev) where product_id=pr), 'Staff can read counter availability';
  assert (select count(*)=0 from public.inventory_movements), 'Staff cannot read stock ledger';
  begin
    perform public.change_product_stock(ev,pr,'in',1,'Staff attempt',1,3,'90000000-0000-0000-0000-000000000011');
    raise exception 'FAIL: Staff changed stock';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
do $$ begin
  begin
    perform public.get_product_stock((select (value#>>'{}')::uuid from test_values where key='stock_event'));
    raise exception 'FAIL: outsider read availability';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon','public.get_product_stock(uuid)','execute'), 'Anonymous denied';
  assert not has_function_privilege('anon','private.change_product_stock(uuid,uuid,text,numeric,text,numeric,numeric,uuid)','execute'), 'Private mutation denied';
end $$;
