-- Every fixture and assertion is rolled back by the test runner.
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data) values
 ('10000000-0000-0000-0000-000000000001','owner@example.test',now(),'{"provider":"google"}'),
 ('10000000-0000-0000-0000-000000000002','staff@example.test',now(),'{"provider":"google"}'),
 ('10000000-0000-0000-0000-000000000003','outsider@example.test',now(),'{"provider":"google"}');
insert into public.staff_allowlist(business_unit_id,email,role)
select id,'owner@example.test','owner' from public.business_units where slug='workshop';
insert into public.staff_allowlist(business_unit_id,email,role)
select id,'staff@example.test','staff' from public.business_units where slug='workshop';
create temp table test_values(key text primary key,value jsonb);
grant all on test_values to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'event',to_jsonb(public.create_event(
 (select id from public.business_units where slug='workshop'),'Test event','2026-10-25',5,'COZY'));
select public.save_product(b.id,p.id,p.category_id,p.sku,p.name,p.price_vnd,
  case when p.sku='WS-TOTE-L-100' then 30000 else 5000 end,true)
from public.products p join public.business_units b on b.id=p.business_unit_id
where p.sku in ('WS-TOTE-L-100','FB-OREO-025');
insert into public.inventory_items(business_unit_id,name,spec)
select id,'Tote blank','Large' from public.business_units where slug='workshop';
insert into public.event_inventory(business_unit_id,event_id,inventory_item_id,stock_prepared,low_stock_threshold)
select business_unit_id,(select (value#>>'{}')::uuid from test_values where key='event'),id,10,2 from public.inventory_items;
insert into public.product_inventory_links(business_unit_id,event_id,product_id,event_inventory_id,quantity_per_unit)
select s.business_unit_id,s.event_id,p.id,s.id,1 from public.event_inventory s
join public.products p on p.business_unit_id=s.business_unit_id and p.sku='WS-TOTE-L-100';
insert into public.costs(business_unit_id,event_id,category,amount_vnd)
select business_unit_id,id,'venue',10000 from public.events;

do $$ begin
  assert (select count(*) from public.products)=11, 'Exact seed product count';
  assert (select count(*) from public.staff_allowlist)=2, 'Owner sees allowlist';
  begin
    update public.staff_allowlist set active=false where email='owner@example.test';
    raise exception 'FAIL: last owner disabled';
  exception when check_violation then assert sqlerrm='app.last_owner'; end;
end $$;

insert into test_values select 'order',public.create_order(
  (select (value#>>'{}')::uuid from test_values where key='event'),
  '20000000-0000-0000-0000-000000000001',
  (select jsonb_agg(jsonb_build_object('product_id',id,'quantity',case when sku='WS-TOTE-L-100' then 2 else 1 end,
    'options',jsonb_build_object('font','Serif','fabric_colour','Cream')))
    from public.products where sku in ('WS-TOTE-L-100','FB-OREO-025')),
  true,'Test customer',null,null,false,null);

do $$ declare ticket uuid; item uuid; before_count bigint; begin
  select (value->>'ticket_id')::uuid into ticket from test_values where key='order';
  assert (select ticket_number from public.tickets where id=ticket)='COZY-001';
  assert (select revenue_vnd from public.event_financials)=0, 'Unpaid revenue excluded';
  assert (select stock_remaining from public.inventory_status)=8, 'Unpaid consumes stock';
  begin
    perform public.set_ticket_status(ticket,'in_progress');
    raise exception 'FAIL: status skipped';
  exception when check_violation then assert sqlerrm='app.invalid_transition'; end;
  assert public.record_ticket_print(ticket)=1;
  assert public.record_ticket_print(ticket)=2;
  perform public.set_ticket_status(ticket,'waiting');
  perform public.set_ticket_status(ticket,'in_progress');
  perform public.set_ticket_status(ticket,'completed');
  assert (select count(*) from public.ticket_transitions where ticket_id=ticket)=5, 'All transitions logged';
  assert (select status from public.queue_entries where ticket_id=ticket)='completed';
  select id into item from public.order_items where sku_snapshot='WS-TOTE-L-100';
  perform public.update_order_item(item,3,'{"font":"Serif"}');
  select count(*) into before_count from public.inventory_movements;
  perform public.update_order_item(item,3,'{"font":"Serif"}');
  assert (select count(*) from public.inventory_movements)=before_count, 'Idempotent stock update';
  assert (select stock_remaining from public.inventory_status)=7;
  perform public.set_order_payment((select (value->>'order_id')::uuid from test_values where key='order'),'paid','cash');
  assert (select revenue_vnd from public.event_financials)=325000, 'Paid revenue';
  assert (select workshop_revenue_vnd from public.event_financials)=300000;
  assert (select food_beverage_revenue_vnd from public.event_financials)=25000;
  assert (select profit_vnd from public.event_financials)=220000, 'Profit less COGS and expenses';
  assert (select stock_remaining from public.inventory_status)=7, 'Payment does not decrement twice';
  assert (select sum(revenue_percent) from public.product_revenue)=100;
end $$;

do $$ declare p public.products; begin
  select * into p from public.products where sku='WS-TOTE-L-100';
  begin
    perform public.save_product(p.business_unit_id,p.id,p.category_id,p.sku,p.name,110000,30000,true);
    raise exception 'FAIL: sold SKU price changed';
  exception when check_violation then assert sqlerrm='app.sold_sku_immutable'; end;
  perform public.save_product(p.business_unit_id,p.id,p.category_id,p.sku,p.name,100000,40000,true);
  assert (select unit_cost_vnd from public.order_item_financials f join public.order_items i on i.id=f.order_item_id
    where i.sku_snapshot='WS-TOTE-L-100')=30000, 'Unit cost snapshot unchanged';
end $$;

-- A second unit proves row isolation even when the caller supplies its UUID.
reset role;
insert into public.business_units(id,slug,name) values('30000000-0000-0000-0000-000000000001','other-unit','Other unit');
insert into public.events(id,business_unit_id,name,event_date,status)
values('30000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','Other event','2026-10-25','active');
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test","user_metadata":{"role":"owner"},"app_metadata":{"role":"owner"}}',true);

do $$ declare order_id uuid; event_id uuid; p public.products; result jsonb; begin
  select (value->>'order_id')::uuid into order_id from test_values where key='order';
  select (value#>>'{}')::uuid into event_id from test_values where key='event';
  assert (select count(*) from public.business_units)=1, 'Other unit hidden';
  assert (select count(*) from public.events)=1;
  assert (select count(*) from public.product_costs)=0, 'Staff cannot read unit costs';
  assert (select count(*) from public.order_item_financials)=0, 'Staff cannot read financial snapshots';
  assert (select count(*) from public.costs)=0, 'Staff cannot read costs';
  assert (select count(*) from public.event_financials)=0, 'Staff cannot read revenue or profit';
  assert (select count(*) from public.paid_order_lines)=0;
  assert (select count(*) from public.product_revenue)=0;
  assert (select count(*) from public.revenue_over_time)=0;
  assert (select count(*) from public.audit_log)=0, 'Audit cannot leak money';
  assert (select completed_count from public.operations_summary)=1;
  begin
    perform public.get_order_checkout(order_id);
    raise exception 'FAIL: staff reads paid financial history';
  exception when insufficient_privilege then assert sqlerrm='app.owner_required'; end;
  begin
    update public.orders set payment_status='cancelled' where id=order_id;
    raise exception 'FAIL: direct order mutation';
  exception when insufficient_privilege then null; end;
  select * into p from public.products limit 1;
  begin
    perform public.save_product(p.business_unit_id,p.id,p.category_id,p.sku,p.name,p.price_vnd,0,true);
    raise exception 'FAIL: staff updates product';
  exception when insufficient_privilege then assert sqlerrm='app.owner_required'; end;
  begin
    perform public.create_event(p.business_unit_id,'Bad','2026-10-25',null,'BAD');
    raise exception 'FAIL: staff creates event';
  exception when insufficient_privilege then assert sqlerrm='app.owner_required'; end;
  begin
    perform public.save_inventory(p.business_unit_id,event_id,null,'Bad','',null,0);
    raise exception 'FAIL: staff writes inventory';
  exception when insufficient_privilege then assert sqlerrm='app.owner_required'; end;
  begin
    perform public.create_order('30000000-0000-0000-0000-000000000002',gen_random_uuid(),'[]');
    raise exception 'FAIL: cross-unit order';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
  begin
    insert into public.costs(business_unit_id,event_id,category,amount_vnd)
    values(p.business_unit_id,event_id,'bad',1);
    raise exception 'FAIL: staff writes costs';
  exception when insufficient_privilege then null; end;
  perform public.set_order_payment(order_id,'refunded',null);
  result := public.create_order(event_id,'20000000-0000-0000-0000-000000000002',
    jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='WS-TOTE-L-100'),'quantity',1)),
    true,'Cancelled fixture',null,null,false,null);
  insert into test_values values('cancel_order',result);
  perform public.set_ticket_status((result->>'ticket_id')::uuid,'cancelled');
  perform public.set_order_payment((result->>'order_id')::uuid,'cancelled',null);
  assert not exists(select 1 from public.queue_entries where status<>'cancelled' and ticket_id=(result->>'ticket_id')::uuid);
  assert (result->>'ticket_number')='COZY-002';
  -- Retry is safe and does not create another order or ticket.
  perform public.create_order(event_id,'20000000-0000-0000-0000-000000000002',
    '[{}]',true,'Cancelled fixture',null,null,false,null);
  assert (select count(*) from public.orders)=2;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
do $$ begin
  assert (select revenue_vnd from public.event_financials)=0, 'Refund and cancellation revenue excluded';
  assert (select stock_remaining from public.inventory_status)=7, 'Refund retains stock usage; cancellation reverses';
  perform public.soft_delete_order((select (value->>'order_id')::uuid from test_values where key='order'));
  assert (select stock_remaining from public.inventory_status)=10, 'Soft delete reverses stock';
  assert (select count(*) from public.orders where deleted_at is not null)=1, 'Order preserved';
  perform public.save_inventory((select id from public.business_units),
    (select (value#>>'{}')::uuid from test_values where key='event'),null,'Uncounted supply','',null,2);
  assert exists(select 1 from public.inventory_status where name='Uncounted supply' and stock_status='not_entered' and stock_remaining is null);
  begin
    perform public.create_order((select (value#>>'{}')::uuid from test_values where key='event'),gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='WS-TOTE-L-100'),
        'quantity',1,'expected_price_vnd',1)));
    raise exception 'FAIL: stale checkout price accepted';
  exception when check_violation then assert sqlerrm='app.price_changed'; end;
  perform public.create_order((select (value#>>'{}')::uuid from test_values where key='event'),gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='WS-TOTE-S-060'),'quantity',1)),
    false,null,null,null,true,'cash');
  assert (select profit_vnd from public.event_financials) is null, 'Unknown historical cost keeps profit incomplete';
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"email":"outsider@example.test"}',true);
do $$ begin
  assert public.get_access_context()='[]'::jsonb;
  assert (select count(*) from public.products)=0;
  assert (select count(*) from public.queue_entries)=0;
  assert (select count(*) from public.orders)=0;
  begin
    perform public.record_ticket_print((select (value->>'ticket_id')::uuid from test_values where key='order'));
    raise exception 'FAIL: outsider mutates ticket';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
end $$;

reset role;
update public.staff_allowlist set active=false where email='staff@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test"}',true);
do $$ begin
  assert (select count(*) from public.queue_entries)=0, 'Revoked allowlist blocks existing token';
end $$;

reset role;
set local role supabase_auth_admin;
do $$ begin
  assert public.before_user_created('{"user":{"email":"owner@example.test","app_metadata":{"provider":"google"}}}')='{}'::jsonb;
  assert public.before_user_created('{"user":{"email":"outsider@example.test","app_metadata":{"provider":"google"}}}') ? 'error';
  assert public.before_user_created('{"user":{"email":"owner@example.test","app_metadata":{}}}') ? 'error';
end $$;
reset role;
set local role anon;
do $$ begin
  begin
    perform count(*) from public.products;
    raise exception 'FAIL: anon reads products';
  exception when insufficient_privilege then null; end;
  begin
    perform public.get_access_context();
    raise exception 'FAIL: anon calls API';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'All Phase 1 database assertions passed' as result;
