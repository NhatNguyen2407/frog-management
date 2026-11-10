-- Synthetic history and CSV read-model checks; the runner rolls everything back.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'report_a',to_jsonb(public.create_event(
  (select id from public.business_units where slug='workshop'),'Report A','2026-11-02',30,'REPA'));
insert into test_values select 'report_b',to_jsonb(public.create_event(
  (select id from public.business_units where slug='workshop'),'Report B','2026-11-03',30,'REPB'));

do $$ declare event_a uuid; event_b uuid; product uuid; result jsonb; kind text; begin
  select (value#>>'{}')::uuid into event_a from test_values where key='report_a';
  select (value#>>'{}')::uuid into event_b from test_values where key='report_b';
  select id into product from public.products where sku='WS-TOTE-L-100';
  result := public.create_order(event_a,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id',product,'quantity',2)),true,'Đặng Minh','0123456789',null,true,'cash');
  insert into test_values values('report_paid_a',result);
  result := public.create_order(event_b,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1)),true,'Đặng Minh',null,null,true,'bank_transfer');
  insert into test_values values('report_paid_b',result);
  foreach kind in array array['unpaid','refunded','cancelled','deleted'] loop
    result := public.create_order(event_a,gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('product_id',product,'quantity',1)),true,kind,null,null,kind in ('refunded','deleted'),
      case when kind in ('refunded','deleted') then 'cash'::public.payment_method else null end);
    if kind='deleted' then perform public.soft_delete_order((result->>'order_id')::uuid);
    elsif kind<>'unpaid' then perform public.set_order_payment((result->>'order_id')::uuid,kind::public.payment_status); end if;
    insert into test_values values('report_'||kind,result);
  end loop;
  result := public.create_order(event_a,gen_random_uuid(),jsonb_build_array(
    jsonb_build_object('product_id',product,'quantity',1),
    jsonb_build_object('product_id',(select id from public.products where sku='FB-OREO-025'),'quantity',1)));
  perform public.update_order_item((select id from public.order_items where order_id=(result->>'order_id')::uuid and sku_snapshot='FB-OREO-025'),0,'{}');
  perform public.set_order_payment((result->>'order_id')::uuid,'paid','cash');
  insert into test_values values('report_voided',result);
  insert into public.costs(business_unit_id,event_id,category,note,amount_vnd,cost_date)
  values((select id from public.business_units where slug='workshop'),event_a,'venue','=SUM(1,1)',30000,'2026-11-02'),
    ((select id from public.business_units where slug='workshop'),event_b,'venue','Other day',90000,'2026-11-03');
end $$;

reset role;
-- Backdate only disposable fixtures; application creation timestamps stay immutable.
alter table public.orders disable trigger touch_updated_at;
update public.orders set created_at='2026-11-01 17:00:00+00'
where event_id in (select (value#>>'{}')::uuid from test_values where key in ('report_a','report_b'));
alter table public.orders enable trigger touch_updated_at;
update public.orders set paid_at='2026-11-02 17:00:00+00'
where id=(select (value->>'order_id')::uuid from test_values where key='report_paid_a');
update public.orders set paid_at='2026-11-02 16:59:59.999999+00'
where id=(select (value->>'order_id')::uuid from test_values where key='report_paid_b');
insert into public.orders(business_unit_id,event_id,request_id,created_by)
values('30000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002',gen_random_uuid(),'10000000-0000-0000-0000-000000000001');
set local role authenticated;

do $$ declare event_a uuid; event_b uuid; order_a uuid; order_b uuid; begin
  select (value#>>'{}')::uuid into event_a from test_values where key='report_a';
  select (value#>>'{}')::uuid into event_b from test_values where key='report_b';
  select (value->>'order_id')::uuid into order_a from test_values where key='report_paid_a';
  select (value->>'order_id')::uuid into order_b from test_values where key='report_paid_b';
  assert (select count(*) from public.customer_history where customer_name='Đặng Minh')=2, 'Matching names remain separate orders across workshops';
  assert (select count(*) from public.customer_history where search_text ilike '%dang minh%')=2, 'Unaccented Vietnamese search';
  assert (select phone_zalo from public.customer_history where id=order_a)='0123456789', 'Phone keeps its leading zero';
  assert (select total_vnd from public.customer_history where id=order_a)=200000, 'Sale-time prices are used';
  assert (select cost_of_goods_vnd from public.sales_report_lines where order_id=order_a)=80000, 'Historical unit costs are used';
  assert exists(select 1 from public.sales_report_lines where sku_snapshot='WS-TOTE-S-060' and cost_of_goods_vnd is null), 'Unknown historical cost stays unknown';
  assert exists(select 1 from public.customer_history where id=order_a and created_at >= '2026-11-02 00:00:00+07' and created_at <= '2026-11-02 23:59:59.999999+07'), 'Order date follows Vietnam midnight';
  assert not exists(select 1 from public.sales_report_lines where order_id=order_a and paid_at >= '2026-11-02 00:00:00+07' and paid_at <= '2026-11-02 23:59:59.999999+07'), 'Revenue uses payment date, not creation date';
  assert exists(select 1 from public.sales_report_lines where order_id=order_b and paid_at >= '2026-11-02 00:00:00+07' and paid_at <= '2026-11-02 23:59:59.999999+07'), 'Last microsecond is included';
  assert not exists(select 1 from public.sales_report_lines where event_id=event_a and order_id=order_b), 'Workshop filter stays scoped';
  assert not exists(select 1 from public.customer_history where id=(select (value->>'order_id')::uuid from test_values where key='report_deleted')), 'Archived order excluded';
  assert not exists(select 1 from public.sales_report_lines where order_id in (
    select (value->>'order_id')::uuid from test_values where key in ('report_unpaid','report_refunded','report_cancelled','report_deleted'))), 'Only live Paid items contribute revenue';
  assert (select jsonb_array_length(items) from public.customer_history where id=(select (value->>'order_id')::uuid from test_values where key='report_voided'))=1, 'Voided item excluded from order history';
  assert (select total_vnd from public.customer_history where id=(select (value->>'order_id')::uuid from test_values where key='report_voided'))=100000;
  assert (select count(*) from public.sales_report_lines where order_id=(select (value->>'order_id')::uuid from test_values where key='report_voided'))=1, 'Voided item excluded from revenue';
  assert (select sum(amount_vnd) from public.expense_report where event_id=event_a and cost_date between '2026-11-02' and '2026-11-02')=30000, 'Expense date and workshop filter';
  assert not exists(select 1 from public.customer_history where event_id='30000000-0000-0000-0000-000000000002'), 'Other unit stays hidden from this Owner';
  assert not has_table_privilege('authenticated','public.customer_history','UPDATE'), 'History is read-only';
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test","user_metadata":{"role":"owner"}}',true);
do $$ begin
  assert (select count(*) from public.customer_history)=0, 'Staff cannot read customer history';
  assert (select count(*) from public.sales_report_lines)=0, 'Staff cannot read sales CSV data';
  assert (select count(*) from public.expense_report)=0, 'Staff cannot read expense CSV data';
end $$;
reset role;
set local role anon;
do $$ begin
  assert not has_table_privilege(current_user,'public.customer_history','SELECT');
  assert not has_table_privilege(current_user,'public.sales_report_lines','SELECT');
  assert not has_table_privilege(current_user,'public.expense_report','SELECT');
end $$;
reset role;
select 'All customer history and report assertions passed' as result;
