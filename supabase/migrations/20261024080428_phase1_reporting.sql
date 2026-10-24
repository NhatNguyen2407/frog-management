begin;

create view public.paid_order_lines with (security_invoker = true) as
select i.business_unit_id, i.event_id, o.id as order_id, i.id as order_item_id,
  i.product_id, i.sku_snapshot, i.name_snapshot, i.category_code_snapshot, i.quantity,
  f.unit_price_vnd, f.unit_cost_vnd, i.quantity * f.unit_price_vnd as revenue_vnd,
  i.quantity * f.unit_cost_vnd as cost_of_goods_vnd, o.paid_at,
  (o.paid_at at time zone 'Asia/Ho_Chi_Minh')::date as revenue_date
from public.order_items i
join public.orders o on o.id = i.order_id
join public.order_item_financials f on f.order_item_id = i.id
where o.payment_status = 'paid' and o.deleted_at is null and i.voided_at is null
  and private.is_owner(i.business_unit_id);

create view public.event_financials with (security_invoker = true) as
with sales as (
  select event_id, sum(revenue_vnd) as revenue_vnd,
    sum(revenue_vnd) filter(where category_code_snapshot = 'workshop') as workshop_revenue_vnd,
    sum(revenue_vnd) filter(where category_code_snapshot = 'food_beverage') as food_beverage_revenue_vnd,
    sum(cost_of_goods_vnd) as cost_of_goods_vnd,
    count(*) filter(where unit_cost_vnd is null) as missing_unit_cost_count,
    sum(quantity) as items_sold
  from public.paid_order_lines group by event_id
), expenses as (
  select event_id, sum(amount_vnd) as event_costs_vnd from public.costs group by event_id
), counts as (
  select event_id, count(*) filter(where payment_status = 'paid') as paid_order_count,
    count(*) filter(where payment_status = 'unpaid') as unpaid_order_count
  from public.orders where deleted_at is null group by event_id
)
select e.id as event_id, e.business_unit_id, e.name as event_name, e.event_date,
  coalesce(s.revenue_vnd, 0) as revenue_vnd,
  coalesce(s.workshop_revenue_vnd, 0) as workshop_revenue_vnd,
  coalesce(s.food_beverage_revenue_vnd, 0) as food_beverage_revenue_vnd,
  coalesce(s.cost_of_goods_vnd, 0) as cost_of_goods_vnd,
  coalesce(x.event_costs_vnd, 0) as event_costs_vnd,
  coalesce(s.cost_of_goods_vnd, 0) + coalesce(x.event_costs_vnd, 0) as total_costs_vnd,
  coalesce(s.missing_unit_cost_count, 0) as missing_unit_cost_count,
  case when coalesce(s.missing_unit_cost_count, 0) > 0 then null else
    coalesce(s.revenue_vnd, 0) - coalesce(s.cost_of_goods_vnd, 0) - coalesce(x.event_costs_vnd, 0) end as profit_vnd,
  case when coalesce(s.missing_unit_cost_count, 0) > 0 or coalesce(s.revenue_vnd, 0) = 0 then null else
    (s.revenue_vnd - coalesce(s.cost_of_goods_vnd, 0) - coalesce(x.event_costs_vnd, 0)) / s.revenue_vnd * 100 end as margin_percent,
  coalesce(c.paid_order_count, 0) as paid_order_count,
  coalesce(c.unpaid_order_count, 0) as unpaid_order_count,
  coalesce(s.items_sold, 0) as items_sold
from public.events e left join sales s on s.event_id = e.id
left join expenses x on x.event_id = e.id left join counts c on c.event_id = e.id
where private.is_owner(e.business_unit_id);

create view public.product_revenue with (security_invoker = true) as
with revenue as (
  select business_unit_id, event_id, product_id, sku_snapshot, name_snapshot, category_code_snapshot,
    sum(quantity) as items_sold, sum(revenue_vnd) as revenue_vnd
  from public.paid_order_lines group by business_unit_id, event_id, product_id, sku_snapshot, name_snapshot, category_code_snapshot
)
select *, revenue_vnd / nullif(sum(revenue_vnd) over(partition by event_id), 0) * 100 as revenue_percent
from revenue;

create view public.revenue_over_time with (security_invoker = true) as
select business_unit_id, event_id,
  date_trunc('hour', paid_at at time zone 'Asia/Ho_Chi_Minh') as local_hour,
  sum(revenue_vnd) as revenue_vnd
from public.paid_order_lines group by business_unit_id, event_id, local_hour;

create view public.inventory_status with (security_invoker = true) as
select e.business_unit_id, e.event_id, e.id as event_inventory_id,
  e.inventory_item_id, i.name, i.spec, e.stock_prepared, e.low_stock_threshold,
  coalesce(sum(-m.quantity_delta) filter(where m.order_item_id is not null), 0) as stock_used,
  coalesce(sum(m.quantity_delta) filter(where m.order_item_id is null), 0) as manual_adjustments,
  case when e.stock_prepared is null then null else e.stock_prepared + coalesce(sum(m.quantity_delta), 0) end as stock_remaining,
  case when e.stock_prepared is null then 'not_entered'
    when e.stock_prepared + coalesce(sum(m.quantity_delta), 0) <= 0 then 'out'
    when e.stock_prepared + coalesce(sum(m.quantity_delta), 0) <= e.low_stock_threshold then 'low'
    else 'ok' end as stock_status
from public.event_inventory e join public.inventory_items i on i.id = e.inventory_item_id
left join public.inventory_movements m on m.event_inventory_id = e.id
where private.is_owner(e.business_unit_id)
group by e.id, i.id;

create view public.operations_summary with (security_invoker = true) as
select e.business_unit_id, e.id as event_id,
  count(t.id) filter(where t.status = 'registered') as registered_count,
  count(t.id) filter(where t.status = 'ticket_printed') as printed_count,
  count(t.id) filter(where t.status = 'waiting') as waiting_count,
  count(t.id) filter(where t.status = 'in_progress') as in_progress_count,
  count(t.id) filter(where t.status = 'completed') as completed_count,
  count(t.id) filter(where t.status = 'cancelled') as cancelled_count
from public.events e left join public.tickets t on t.event_id = e.id
where private.is_member(e.business_unit_id) group by e.id;

grant select on public.paid_order_lines, public.event_financials, public.product_revenue,
  public.revenue_over_time, public.inventory_status, public.operations_summary to authenticated;
revoke all on public.paid_order_lines, public.event_financials, public.product_revenue,
  public.revenue_over_time, public.inventory_status, public.operations_summary from anon, public;

commit;
