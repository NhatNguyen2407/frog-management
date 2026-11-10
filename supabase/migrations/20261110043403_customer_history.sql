begin;

create view public.customer_history with (security_invoker = true) as
select o.id, o.business_unit_id, o.event_id, e.name as event_name, o.created_at,
  o.paid_at, o.payment_status, o.payment_method, o.ticket_id, t.ticket_number,
  t.customer_name, t.phone_zalo, t.checked_in_at, lines.items, lines.total_vnd,
  lower(translate(regexp_replace(normalize(concat_ws(' ',o.id::text,t.customer_name,
    t.phone_zalo,t.ticket_number),NFD),U&'[\0300-\036f]','','g'),'đĐ','dD')) as search_text
from public.orders o
join public.events e on e.id=o.event_id
left join public.tickets t on t.id=o.ticket_id
left join lateral (
  select coalesce(jsonb_agg(jsonb_build_object('name',i.name_snapshot,'quantity',i.quantity)
      order by i.created_at,i.id),'[]'::jsonb) as items,
    case when count(*) filter(where f.unit_price_vnd is null)>0 then null
      else coalesce(sum(i.quantity*f.unit_price_vnd),0) end as total_vnd
  from public.order_items i left join public.order_item_financials f on f.order_item_id=i.id
  where i.order_id=o.id and i.voided_at is null
) lines on true
where o.deleted_at is null and private.is_owner(o.business_unit_id);

create view public.sales_report_lines with (security_invoker = true) as
select l.*, h.event_name, h.customer_name, h.ticket_number
from public.paid_order_lines l join public.customer_history h on h.id=l.order_id;

create view public.expense_report with (security_invoker = true) as
select c.*, e.name as event_name
from public.costs c join public.events e on e.id=c.event_id
where private.is_owner(c.business_unit_id);

revoke all on public.customer_history, public.sales_report_lines, public.expense_report from public, anon, authenticated;
grant select on public.customer_history, public.sales_report_lines, public.expense_report to authenticated;

commit;
