-- Synthetic receipt checks run after reporting.sql and are rolled back by the runner.
reset role;
update public.staff_allowlist set active=true where email='staff@example.test';
insert into test_values select 'receipt_other',to_jsonb(id) from public.orders
where business_unit_id='30000000-0000-0000-0000-000000000001' limit 1;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'receipt_food',public.create_order(
  (select (value#>>'{}')::uuid from test_values where key='report_a'),gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='FB-OREO-025'),'quantity',1)),
  false,null,null,null,true,'cash');

do $$ declare target uuid; begin
  select (value->>'order_id')::uuid into target from test_values where key='report_paid_a';
  assert (select unit_price_vnd from public.get_order_receipt_prices(target))=100000, 'Owner reads saved selling prices';
end $$;

reset role;
create function pg_temp.receipt_state() returns jsonb language sql as $$
  select jsonb_build_object(
    'orders',(select jsonb_agg(o order by id) from public.orders o),
    'items',(select jsonb_agg(i order by id) from public.order_items i),
    'tickets',(select jsonb_agg(t order by id) from public.tickets t),
    'queue',(select jsonb_agg(q order by id) from public.queue_entries q),
    'stock',(select jsonb_agg(s order by id) from public.inventory_movements s));
$$;
insert into test_values values('receipt_before',pg_temp.receipt_state());
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test","user_metadata":{"role":"owner"}}',true);

do $$ declare target uuid; price jsonb; begin
  select (value->>'order_id')::uuid into target from test_values where key='report_paid_a';
  select to_jsonb(p) into price from public.get_order_receipt_prices(target) p;
  assert (price->>'unit_price_vnd')::bigint=100000, 'Staff reads Paid receipt selling prices';
  assert (select array_agg(k order by k) from jsonb_object_keys(price) k)=array['order_item_id','unit_price_vnd'], 'Receipt API exposes only item ID and selling price';
  assert (select sum(i.quantity*p.unit_price_vnd) from public.get_order_receipt_prices(target) p
    join public.order_items i on i.id=p.order_item_id)=200000, 'Customer bill keeps the saved order total';
  select (value->>'order_id')::uuid into target from test_values where key='report_unpaid';
  assert (select count(*) from public.get_order_receipt_prices(target))=1, 'Unpaid receipt supported';
  select (value->>'order_id')::uuid into target from test_values where key='receipt_food';
  assert (select unit_price_vnd from public.get_order_receipt_prices(target))=25000, 'F&B receipt works without a ticket';
  select (value->>'order_id')::uuid into target from test_values where key='report_voided';
  assert (select count(*) from public.get_order_receipt_prices(target))=1, 'Voided item excluded';
  assert (select count(*) from public.order_item_financials)=0, 'Direct financial snapshots remain Owner-only';
  assert (select count(*) from public.product_costs)=0, 'Cost prices remain Owner-only';
  assert (select count(*) from public.customer_history)=0, 'Customer history remains Owner-only';
  assert (select count(*) from public.sales_report_lines)=0, 'Sales CSV remains Owner-only';
  assert (select count(*) from public.expense_report)=0, 'Expenses remain Owner-only';
  assert (select count(*) from public.event_financials)=0, 'Aggregate revenue and profit remain Owner-only';
  begin
    perform public.get_order_receipt_prices((select (value#>>'{}')::uuid from test_values where key='receipt_other'));
    raise exception 'FAIL: other unit receipt';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
  begin
    perform public.get_order_receipt_prices((select (value->>'order_id')::uuid from test_values where key='report_deleted'));
    raise exception 'FAIL: archived receipt';
  exception when no_data_found then assert sqlerrm='app.not_found'; end;
  begin
    perform public.get_order_receipt_prices(gen_random_uuid());
    raise exception 'FAIL: unknown receipt';
  exception when no_data_found then assert sqlerrm='app.not_found'; end;
end $$;

reset role;
do $$ begin
  assert pg_temp.receipt_state()=(select value from test_values where key='receipt_before'), 'Receipt reads do not change orders, tickets, queue or stock';
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"email":"outsider@example.test","app_metadata":{"role":"owner"}}',true);
do $$ begin
  begin
    perform public.get_order_receipt_prices((select (value->>'order_id')::uuid from test_values where key='report_paid_a'));
    raise exception 'FAIL: outsider receipt';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
end $$;
reset role;
update public.staff_allowlist set active=false where email='staff@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test"}',true);
do $$ begin
  begin
    perform public.get_order_receipt_prices((select (value->>'order_id')::uuid from test_values where key='report_paid_a'));
    raise exception 'FAIL: revoked Staff receipt';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
end $$;
reset role;
do $$ begin
  assert not has_function_privilege('anon','private.get_order_receipt_prices(uuid)','EXECUTE');
end $$;
set local role anon;
do $$ begin
  assert not has_function_privilege(current_user,'public.get_order_receipt_prices(uuid)','EXECUTE');
  assert not has_schema_privilege(current_user,'private','USAGE');
  begin
    perform public.get_order_receipt_prices(gen_random_uuid());
    raise exception 'FAIL: anonymous receipt';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'All receipt pricing and permission assertions passed' as result;
