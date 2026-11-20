-- Integrated main-app journey, entirely inside the runner's disposable transaction.
reset role;
update public.staff_allowlist set active=true where email='staff@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'workflow_event',to_jsonb(public.create_event(
 (select id from public.business_units where slug='workshop'),'Workflow QA','2026-11-20',null,'FLOW'));
insert into test_values select 'workflow_capacity',to_jsonb(public.create_event(
 (select id from public.business_units where slug='workshop'),'Capacity QA','2026-11-20',1,'CAP'));

do $$
declare ev uuid := (select (value#>>'{}')::uuid from test_values where key='workflow_event');
  pr uuid := (select id from public.products where sku='WS-TOTE-L-100');
  sale jsonb; ticket uuid; v_order uuid; before_stock numeric; before_revenue bigint;
  before_moves bigint; before_audit bigint;
begin
  perform public.change_product_stock(ev,pr,'adjust',10,'Workflow setup',1,null,gen_random_uuid());
  sale := public.create_order(ev,'a0000000-0000-0000-0000-000000000001',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Workflow customer');
  ticket := (sale->>'ticket_id')::uuid; v_order := (sale->>'order_id')::uuid;
  insert into test_values values('workflow_order',sale);
  assert (select stock_remaining=9 from public.get_product_stock(ev) where product_id=pr);
  -- Order-label reads do not advance preparation or record a ticket print request.
  perform public.get_order_receipt_prices(v_order);
  assert (select status='registered' and print_count=0 from public.tickets where id=ticket);
  begin
    perform public.set_ticket_status(ticket,'in_progress');
    raise exception 'FAIL: initial production step skipped';
  exception when check_violation then assert sqlerrm='app.invalid_transition'; end;
  assert public.record_ticket_print(ticket)=1;
  begin
    perform public.set_ticket_status(ticket,'waiting');
    raise exception 'FAIL: printing bypassed payment gate';
  exception when check_violation then assert sqlerrm='app.ticket_payment_required'; end;
  perform public.set_order_payment(v_order,'paid','cash');
  perform public.set_ticket_check_in(ticket,ev,true);
  select stock_remaining into before_stock from public.get_product_stock(ev) where product_id=pr;
  select revenue_vnd into before_revenue from public.event_financials where event_id=ev;
  select count(*) into before_moves from public.inventory_movements where event_id=ev;
  perform public.set_ticket_status(ticket,'waiting');
  perform public.set_ticket_status(ticket,'in_progress');
  perform public.set_ticket_status(ticket,'completed');
  select count(*) into before_audit from public.audit_log;
  perform public.set_ticket_status(ticket,'completed');
  assert (select count(*)=before_audit from public.audit_log), 'Repeated completion is harmless';
  assert (select status='completed' from public.queue_entries where ticket_id=ticket);
  assert (select count(*)=5 from public.ticket_transitions where ticket_id=ticket);
  assert (select stock_remaining=before_stock from public.get_product_stock(ev) where product_id=pr), 'Queue never changes stock';
  assert (select revenue_vnd=before_revenue from public.event_financials where event_id=ev), 'Queue never changes revenue';
  assert (select count(*)=before_moves from public.inventory_movements where event_id=ev);
  perform public.set_order_payment(v_order,'refunded',null);
  assert (select status='completed' from public.tickets where id=ticket), 'Refund retains completed work history';
  assert (select stock_remaining=9 from public.get_product_stock(ev) where product_id=pr), 'Refund is not a stock return';
  assert not exists(select 1 from public.sales_report_lines where order_id=v_order);

  -- A paid order can enter the queue directly after read-only dual-label printing.
  sale := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Paid waiting',null,null,true,'bank_transfer');
  ticket := (sale->>'ticket_id')::uuid; v_order := (sale->>'order_id')::uuid;
  perform public.set_ticket_status(ticket,'waiting');
  assert (select print_count=0 from public.tickets where id=ticket), 'No extra legacy ticket print is required';
  perform public.set_order_payment(v_order,'refunded',null);
  assert (select status='cancelled' from public.tickets where id=ticket), 'Unfinished refunded ticket leaves production';
  assert (select status='cancelled' from public.queue_entries where ticket_id=ticket);
  assert (select count(*)=3 from public.ticket_transitions where ticket_id=ticket);
  select count(*) into before_audit from public.audit_log;
  perform public.set_order_payment(v_order,'refunded',null);
  assert (select count(*)=before_audit from public.audit_log), 'Refund retry does not repeat writes';
  assert (select stock_remaining=8 from public.get_product_stock(ev) where product_id=pr);
  begin
    perform public.set_ticket_status(ticket,'in_progress');
    raise exception 'FAIL: cancelled/refunded ticket resumed';
  exception when check_violation then assert sqlerrm='app.invalid_transition'; end;
end $$;

do $$
declare ev uuid := (select (value#>>'{}')::uuid from test_values where key='workflow_capacity');
  pr uuid := (select id from public.products where sku='FB-OREO-025');
  sale jsonb; ticket uuid; v_order uuid; before_orders bigint; before_queue bigint;
begin
  perform public.change_product_stock(ev,pr,'adjust',10,'Capacity setup',1,null,gen_random_uuid());
  sale := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Only seat');
  ticket := (sale->>'ticket_id')::uuid; v_order := (sale->>'order_id')::uuid;
  select count(*) into before_orders from public.orders;
  begin
    perform public.create_order(ev,'a0000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'No seat');
    raise exception 'FAIL: event capacity exceeded';
  exception when check_violation then assert sqlerrm='app.event_full'; end;
  assert (select count(*)=before_orders from public.orders), 'Capacity error creates no partial order';
  perform public.set_order_payment(v_order,'cancelled',null);
  assert (select status='cancelled' from public.tickets where id=ticket), 'Cancelling order releases ticket capacity';
  assert (select stock_remaining=10 from public.get_product_stock(ev) where product_id=pr);
  sale := public.create_order(ev,'a0000000-0000-0000-0000-000000000002',jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Seat available',null,null,true,'cash');
  insert into test_values values('workflow_staff_order',sale);
  select count(*) into before_queue from public.queue_entries;
  sale := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),false,null,null,null,true,'cash');
  assert sale->>'ticket_id' is null, 'F&B order without a ticket';
  assert (select count(*)=before_queue from public.queue_entries), 'F&B does not add a queue ticket';
  assert (select stock_remaining=8 from public.get_product_stock(ev) where product_id=pr);
  insert into public.costs(business_unit_id,event_id,category,amount_vnd,cost_date)
    select business_unit_id,ev,'workflow QA',10000,'2026-11-20' from public.events where id=ev;
  assert (select revenue_vnd=50000 and event_costs_vnd=10000 from public.event_financials where event_id=ev), 'Paid sales and expense reconcile';
  assert (select sum(revenue_vnd)=50000 from public.sales_report_lines where event_id=ev);
  assert (select sum(amount_vnd)=10000 from public.expense_report where event_id=ev);
end $$;


do $$
declare ev uuid := (select (value#>>'{}')::uuid from test_values where key='workflow_event');
  pr uuid := (select id from public.products where sku='WS-TOTE-L-100');
  main_sale jsonb; addon jsonb; ticket uuid; before_stock numeric; before_moves bigint;
begin
  main_sale := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Started with addon',null,null,true,'cash');
  ticket := (main_sale->>'ticket_id')::uuid;
  perform public.set_ticket_status(ticket,'waiting');
  perform public.set_ticket_status(ticket,'in_progress');
  addon := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),false,null,null,ticket);
  select stock_remaining into before_stock from public.get_product_stock(ev) where product_id=pr;
  select count(*) into before_moves from public.inventory_movements where event_id=ev;
  begin
    perform public.set_ticket_status(ticket,'completed');
    raise exception 'FAIL: unpaid linked addon bypassed production guard';
  exception when check_violation then assert sqlerrm='app.ticket_payment_required'; end;
  begin
    perform public.set_order_payment((addon->>'order_id')::uuid,'cancelled',null);
    raise exception 'FAIL: unfinished payment cancelled after work started';
  exception when check_violation then assert sqlerrm='app.ticket_in_progress'; end;
  assert (select payment_status='unpaid' from public.orders where id=(addon->>'order_id')::uuid);
  assert (select stock_remaining=before_stock from public.get_product_stock(ev) where product_id=pr), 'Busy-cancel rejection rolls back stock';
  assert (select count(*)=before_moves from public.inventory_movements where event_id=ev);
  perform public.set_order_payment((main_sale->>'order_id')::uuid,'refunded',null);
  assert (select status='cancelled' from public.tickets where id=ticket), 'Refund stops unfinished production';
  perform public.set_order_payment((addon->>'order_id')::uuid,'cancelled',null);
  assert (select stock_remaining=before_stock+1 from public.get_product_stock(ev) where product_id=pr), 'Only cancelled addon returns stock';
  main_sale := public.create_order(ev,gen_random_uuid(),jsonb_build_array(jsonb_build_object('product_id',pr,'quantity',1)),true,'Archived waiting',null,null,true,'cash');
  ticket := (main_sale->>'ticket_id')::uuid;
  perform public.set_ticket_status(ticket,'waiting');
  perform public.soft_delete_order((main_sale->>'order_id')::uuid);
  assert (select status='cancelled' from public.queue_entries where ticket_id=ticket), 'Archived unfinished sale leaves the queue';
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test"}',true);
do $$ declare ticket uuid := (select (value->>'ticket_id')::uuid from test_values where key='workflow_staff_order'); begin
  perform public.set_ticket_status(ticket,'waiting');
  perform public.set_ticket_status(ticket,'in_progress');
  perform public.set_ticket_status(ticket,'completed');
  assert (select status='completed' from public.tickets where id=ticket), 'Staff can complete paid work';
  assert (select count(*)=0 from public.event_financials), 'Queue access does not expose financial reports';
end $$;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"email":"outsider@example.test"}',true);
do $$ begin
  begin
    perform public.set_ticket_status((select (value->>'ticket_id')::uuid from test_values where key='workflow_staff_order'),'completed');
    raise exception 'FAIL: outsider invoked idempotent completion';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
end $$;
reset role;
select 'Integrated workflow assertions passed' as result;
