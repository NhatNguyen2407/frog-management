-- Runs after phase1.sql in the same disposable, rolled-back transaction.
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
insert into test_values select 'checkin_event', to_jsonb(public.create_event(
  (select id from public.business_units where slug='workshop'),'Check-in test','2026-11-10',30,'CHECK'));
insert into test_values select 'checkin_order', public.create_order(
  (select (value#>>'{}')::uuid from test_values where key='checkin_event'),gen_random_uuid(),
  jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='WS-TOTE-L-100'),'quantity',1)),
  true,'Arrival test');

do $$ declare ticket uuid; v_event uuid; begin
  select (value->>'ticket_id')::uuid into ticket from test_values where key='checkin_order';
  select (value#>>'{}')::uuid into v_event from test_values where key='checkin_event';
  assert not (select can_check_in from public.ticket_registrations where id=ticket), 'Unpaid ticket is unavailable';
  begin
    perform public.set_ticket_check_in(ticket,v_event,true);
    raise exception 'FAIL: unpaid check-in';
  exception when check_violation then assert sqlerrm='app.check_in_unavailable'; end;
  begin
    perform public.set_ticket_check_in(ticket,v_event,null);
    raise exception 'FAIL: null attendance';
  exception when check_violation then assert sqlerrm='app.invalid_request'; end;
  begin
    perform public.set_ticket_check_in(ticket,'30000000-0000-0000-0000-000000000002',true);
    raise exception 'FAIL: wrong-event check-in';
  exception when no_data_found then assert sqlerrm='app.not_found'; end;
  perform public.set_order_payment((select (value->>'order_id')::uuid from test_values where key='checkin_order'),'paid','cash');
end $$;
insert into test_values select 'checkin_stock',to_jsonb(count(*)) from public.inventory_movements;
insert into test_values select 'checkin_finance',to_jsonb(f) from public.event_financials f
where event_id=(select (value#>>'{}')::uuid from test_values where key='checkin_event');

reset role;
update public.staff_allowlist set active=true where email='staff@example.test';
set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000002',true);
select set_config('request.jwt.claims','{"email":"staff@example.test"}',true);
do $$ declare ticket uuid; v_event uuid; arrived timestamptz; queue_version text; transitions bigint; sale jsonb; begin
  select (value->>'ticket_id')::uuid into ticket from test_values where key='checkin_order';
  select (value#>>'{}')::uuid into v_event from test_values where key='checkin_event';
  select ctid::text into queue_version from public.queue_entries where ticket_id=ticket;
  select count(*) into transitions from public.ticket_transitions where ticket_id=ticket;
  select to_jsonb(o) into sale from public.orders o where ticket_id=ticket;
  assert (select can_check_in from public.ticket_registrations where id=ticket), 'Paid ticket is available to staff';
  arrived := public.set_ticket_check_in(ticket,v_event,true);
  assert arrived is not null and (select checked_in_at from public.tickets where id=ticket)=arrived, 'Server records arrival';
  assert (select status from public.tickets where id=ticket)='registered', 'Attendance is separate from production';
  assert (select ctid::text from public.queue_entries where ticket_id=ticket)=queue_version, 'Queue is not rewritten';
  assert (select count(*) from public.ticket_transitions where ticket_id=ticket)=transitions, 'No production transition';
  assert (select to_jsonb(o) from public.orders o where ticket_id=ticket)=sale, 'Sale is unchanged';
  begin
    update public.tickets set checked_in_at=null where id=ticket;
    raise exception 'FAIL: direct attendance update';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"email":"owner@example.test"}',true);
do $$ declare ticket uuid; v_event uuid; arrived timestamptz; audit_count bigint; extra jsonb; variant text; result jsonb; begin
  select (value->>'ticket_id')::uuid into ticket from test_values where key='checkin_order';
  select (value#>>'{}')::uuid into v_event from test_values where key='checkin_event';
  select checked_in_at into arrived from public.tickets where id=ticket;
  select count(*) into audit_count from public.audit_log;
  assert public.set_ticket_check_in(ticket,v_event,true)=arrived, 'Retry keeps arrival time';
  assert (select count(*) from public.audit_log)=audit_count, 'Retry does not duplicate the audit';
  assert public.set_ticket_check_in(ticket,v_event,false) is null, 'Undo clears attendance';
  assert (select checked_in_at from public.tickets where id=ticket) is null;
  select count(*) into audit_count from public.audit_log;
  perform public.set_ticket_check_in(ticket,v_event,false);
  assert (select count(*) from public.audit_log)=audit_count, 'Repeated undo does nothing';
  assert (select to_jsonb(count(*)) from public.inventory_movements)=(select value from test_values where key='checkin_stock'), 'Attendance does not change stock';
  assert (select to_jsonb(f) from public.event_financials f where f.event_id=v_event)=(select value from test_values where key='checkin_finance'), 'Attendance does not change finance';

  extra := public.create_order(v_event,gen_random_uuid(),
    jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='FB-OREO-025'),'quantity',1)),
    false,null,null,ticket);
  assert not (select can_check_in from public.ticket_registrations where id=ticket), 'Unpaid linked order blocks arrival';
  begin
    perform public.set_ticket_check_in(ticket,v_event,true);
    raise exception 'FAIL: partial payment check-in';
  exception when check_violation then assert sqlerrm='app.check_in_unavailable'; end;
  perform public.set_order_payment((extra->>'order_id')::uuid,'paid','cash');
  assert public.set_ticket_check_in(ticket,v_event,true) is not null;
  perform public.set_ticket_status(ticket,'cancelled');
  assert not (select can_check_in from public.ticket_registrations where id=ticket);
  begin
    perform public.set_ticket_check_in(ticket,v_event,false);
    raise exception 'FAIL: cancelled ticket undo';
  exception when check_violation then assert sqlerrm='app.check_in_unavailable'; end;
  assert (select checked_in_at from public.tickets where id=ticket) is not null, 'Cancellation keeps attendance history';

  foreach variant in array array['refunded','cancelled','deleted'] loop
    result := public.create_order(v_event,gen_random_uuid(),
      jsonb_build_array(jsonb_build_object('product_id',(select id from public.products where sku='WS-TOTE-L-100'),'quantity',1)),
      true,'Invalid arrival',null,null,variant<>'cancelled',case when variant<>'cancelled' then 'cash'::public.payment_method else null end);
    if variant='deleted' then perform public.soft_delete_order((result->>'order_id')::uuid);
    else perform public.set_order_payment((result->>'order_id')::uuid,variant::public.payment_status); end if;
    ticket := (result->>'ticket_id')::uuid;
    assert not (select can_check_in from public.ticket_registrations where id=ticket), 'Invalid sale is unavailable';
    begin
      perform public.set_ticket_check_in(ticket,v_event,true);
      raise exception 'FAIL: invalid sale check-in';
    exception when check_violation then assert sqlerrm='app.check_in_unavailable'; end;
  end loop;
end $$;

select set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"email":"outsider@example.test"}',true);
do $$ begin
  assert (select count(*) from public.ticket_registrations)=0, 'Registration view keeps RLS';
  begin
    perform public.set_ticket_check_in((select (value->>'ticket_id')::uuid from test_values where key='checkin_order'),
      (select (value#>>'{}')::uuid from test_values where key='checkin_event'),true);
    raise exception 'FAIL: outsider check-in';
  exception when insufficient_privilege then assert sqlerrm='app.not_allowed'; end;
end $$;

reset role;
set local role anon;
do $$ begin
  assert not has_table_privilege(current_user,'public.ticket_registrations','SELECT');
  assert not has_function_privilege(current_user,'public.set_ticket_check_in(uuid,uuid,boolean)','EXECUTE');
end $$;
reset role;
select 'All check-in and permission assertions passed' as result;
