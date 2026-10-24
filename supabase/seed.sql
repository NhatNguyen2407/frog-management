-- Idempotent catalogue only: no customers, costs, events, stock counts or accounts.
begin;
insert into public.business_units(slug, name) values('workshop', 'Workshop')
on conflict (slug) do nothing;

insert into public.product_categories(business_unit_id, code, name)
select b.id, c.code, c.name from public.business_units b
cross join (values ('workshop', 'Workshop'), ('food_beverage', 'F&B')) as c(code, name)
where b.slug = 'workshop'
on conflict (business_unit_id, code) do nothing;

insert into public.products(business_unit_id, category_id, sku, name, price_vnd)
select b.id, c.id, p.sku, p.name, p.price
from (values
  ('WS-TOTE-L-100', 'workshop', 'Tote Large 40x35', 100000),
  ('WS-TOTE-S-060', 'workshop', 'Tote Small 25x20', 60000),
  ('WS-PENCIL-060', 'workshop', 'Pencil case 20x14', 60000),
  ('WS-VELBOA-A3-120', 'workshop', 'Velboa print A3 + DIY set', 120000),
  ('WS-VELBOA-A4-100', 'workshop', 'Velboa print A4 + DIY set', 100000),
  ('WS-EMBROIDERY-150', 'workshop', 'Name embroidery + DIY set', 150000),
  ('FB-OREO-025', 'food_beverage', 'Oreo Choco Chip', 25000),
  ('FB-ORIGINAL-025', 'food_beverage', 'Original Choco Chip', 25000),
  ('FB-CHEESE-025', 'food_beverage', 'Cheese Cookies', 25000),
  ('FB-CHOCO-015', 'food_beverage', 'Choco Crinkle', 15000),
  ('FB-MATCHA-015', 'food_beverage', 'Matcha Crinkle', 15000)
) as p(sku, category, name, price)
join public.business_units b on b.slug = 'workshop'
join public.product_categories c on c.business_unit_id = b.id and c.code = p.category
on conflict (business_unit_id, sku) do nothing;

insert into public.product_costs(business_unit_id, product_id, unit_cost_vnd)
select p.business_unit_id, p.id, null from public.products p
join public.business_units b on b.id = p.business_unit_id where b.slug = 'workshop'
on conflict (product_id) do nothing;
commit;
