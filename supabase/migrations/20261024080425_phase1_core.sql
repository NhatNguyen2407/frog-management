-- Phase 1: generic operations model. No customer, user, or cost seed data.
begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create type public.staff_role as enum ('owner', 'staff');
create type public.event_status as enum ('planned', 'active', 'completed', 'cancelled');
create type public.ticket_status as enum
  ('registered', 'ticket_printed', 'waiting', 'in_progress', 'completed', 'cancelled');
create type public.payment_status as enum ('paid', 'unpaid', 'refunded', 'cancelled');
create type public.payment_method as enum ('cash', 'bank_transfer');

create table public.business_units (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_allowlist (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role public.staff_role not null default 'staff',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, email)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  name text not null check (length(btrim(name)) between 1 and 200),
  event_date date not null,
  status public.event_status not null default 'planned',
  capacity integer check (capacity > 0),
  ticket_prefix text not null default 'COZY' check (ticket_prefix ~ '^[A-Z0-9]{1,12}$'),
  next_ticket_number integer not null default 1 check (next_ticket_number > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_unit_id)
);

create table public.product_categories (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  code text not null check (code ~ '^[a-z0-9_]+$'),
  name text not null check (length(btrim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_unit_id, code),
  unique (id, business_unit_id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  category_id uuid not null,
  sku text not null check (sku ~ '^[A-Z0-9][A-Z0-9_-]{0,63}$'),
  name text not null check (length(btrim(name)) between 1 and 200),
  price_vnd bigint not null check (price_vnd >= 0 and price_vnd <= 1000000000),
  active boolean not null default true,
  sold_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (category_id, business_unit_id) references public.product_categories(id, business_unit_id),
  unique (business_unit_id, sku),
  unique (id, business_unit_id)
);

-- Physical separation lets RLS withhold costs without hiding sales prices.
create table public.product_costs (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  product_id uuid not null,
  unit_cost_vnd bigint check (unit_cost_vnd >= 0 and unit_cost_vnd <= 1000000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (product_id, business_unit_id) references public.products(id, business_unit_id),
  unique (product_id)
);

create table public.event_products (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  product_id uuid not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id),
  foreign key (product_id, business_unit_id) references public.products(id, business_unit_id),
  unique (event_id, product_id)
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  ticket_number text not null,
  sequence_number integer not null check (sequence_number > 0),
  customer_name text not null check (length(btrim(customer_name)) between 1 and 150),
  phone_zalo text check (length(phone_zalo) <= 50),
  status public.ticket_status not null default 'registered',
  print_count integer not null default 0 check (print_count >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id),
  unique (event_id, ticket_number),
  unique (event_id, sequence_number),
  unique (id, event_id, business_unit_id)
);

create table public.ticket_transitions (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  ticket_id uuid not null,
  from_status public.ticket_status,
  to_status public.ticket_status not null,
  changed_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ticket_id, event_id, business_unit_id) references public.tickets(id, event_id, business_unit_id)
);

-- Only these minimal records enter Realtime; never publish customer contact data.
create table public.queue_entries (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  ticket_id uuid not null unique,
  ticket_number text not null,
  display_name text not null,
  status public.ticket_status not null,
  sequence_number integer not null,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (ticket_id, event_id, business_unit_id) references public.tickets(id, event_id, business_unit_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  ticket_id uuid,
  payment_status public.payment_status not null default 'unpaid',
  payment_method public.payment_method,
  paid_at timestamptz,
  request_id uuid not null unique,
  created_by uuid not null references auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id),
  foreign key (ticket_id, event_id, business_unit_id) references public.tickets(id, event_id, business_unit_id),
  check (payment_status <> 'paid' or (payment_method is not null and paid_at is not null)),
  unique (id, event_id, business_unit_id)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  order_id uuid not null,
  product_id uuid not null,
  sku_snapshot text not null,
  name_snapshot text not null,
  category_code_snapshot text not null,
  quantity integer not null check (quantity between 1 and 999),
  options jsonb not null default '{}'::jsonb check (jsonb_typeof(options) = 'object' and octet_length(options::text) <= 16000),
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_id, event_id, business_unit_id) references public.orders(id, event_id, business_unit_id),
  foreign key (product_id, business_unit_id) references public.products(id, business_unit_id),
  unique (id, event_id, business_unit_id)
);

-- Historical financial ledger is owner-only. Checkout RPCs return just the order being handled.
create table public.order_item_financials (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  order_item_id uuid not null unique,
  unit_price_vnd bigint not null check (unit_price_vnd >= 0),
  unit_cost_vnd bigint check (unit_cost_vnd >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_item_id, event_id, business_unit_id) references public.order_items(id, event_id, business_unit_id)
);

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  name text not null check (length(btrim(name)) between 1 and 150),
  spec text not null default '' check (length(spec) <= 300),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, business_unit_id)
);

create table public.event_inventory (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  inventory_item_id uuid not null,
  stock_prepared numeric(12,3) check (stock_prepared >= 0),
  low_stock_threshold numeric(12,3) not null default 0 check (low_stock_threshold >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id),
  foreign key (inventory_item_id, business_unit_id) references public.inventory_items(id, business_unit_id),
  unique (event_id, inventory_item_id),
  unique (id, event_id, business_unit_id)
);

create table public.product_inventory_links (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  product_id uuid not null,
  event_inventory_id uuid not null,
  quantity_per_unit numeric(12,3) not null check (quantity_per_unit > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id),
  foreign key (product_id, business_unit_id) references public.products(id, business_unit_id),
  foreign key (event_inventory_id, event_id, business_unit_id) references public.event_inventory(id, event_id, business_unit_id),
  unique (event_id, product_id, event_inventory_id)
);

-- Snapshots consumption requirements, so later mapping edits cannot rewrite history.
create table public.order_item_inventory (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  order_item_id uuid not null,
  event_inventory_id uuid not null,
  quantity_per_unit numeric(12,3) not null check (quantity_per_unit > 0),
  applied_quantity numeric(12,3) not null default 0 check (applied_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (order_item_id, event_id, business_unit_id) references public.order_items(id, event_id, business_unit_id),
  foreign key (event_inventory_id, event_id, business_unit_id) references public.event_inventory(id, event_id, business_unit_id),
  unique (order_item_id, event_inventory_id)
);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  event_inventory_id uuid not null,
  order_item_id uuid,
  quantity_delta numeric(12,3) not null check (quantity_delta <> 0),
  reason text not null check (reason in ('sale', 'order_adjustment', 'manual_adjustment')),
  note text check (length(note) <= 1000),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_inventory_id, event_id, business_unit_id) references public.event_inventory(id, event_id, business_unit_id),
  foreign key (order_item_id, event_id, business_unit_id) references public.order_items(id, event_id, business_unit_id)
);

create table public.costs (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid not null,
  category text not null check (length(btrim(category)) between 1 and 100),
  amount_vnd bigint not null check (amount_vnd >= 0 and amount_vnd <= 1000000000000),
  note text check (length(note) <= 2000),
  cost_date date not null default (now() at time zone 'Asia/Ho_Chi_Minh')::date,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  business_unit_id uuid not null references public.business_units(id),
  event_id uuid,
  actor_id uuid references auth.users(id),
  entity_table text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (event_id, business_unit_id) references public.events(id, business_unit_id)
);

create index allowlist_active_email on public.staff_allowlist(email, business_unit_id) where active;
create index events_unit_date on public.events(business_unit_id, event_date desc);
create index products_unit_active on public.products(business_unit_id, active);
create index event_products_product on public.event_products(product_id);
create index tickets_event_status on public.tickets(event_id, status, sequence_number);
create index tickets_creator on public.tickets(created_by);
create index transitions_ticket_time on public.ticket_transitions(ticket_id, created_at);
create index queue_event_status on public.queue_entries(event_id, status, sequence_number);
create index orders_event_payment on public.orders(event_id, payment_status, paid_at) where deleted_at is null;
create index orders_ticket on public.orders(ticket_id);
create index orders_creator on public.orders(created_by);
create index items_order on public.order_items(order_id);
create index items_product on public.order_items(product_id);
create index event_inventory_item on public.event_inventory(inventory_item_id);
create index inventory_links_product on public.product_inventory_links(product_id, event_id) where active;
create index inventory_usage_stock on public.order_item_inventory(event_inventory_id);
create index inventory_movements_stock on public.inventory_movements(event_inventory_id, created_at);
create index inventory_movements_order_item on public.inventory_movements(order_item_id);
create index costs_event on public.costs(event_id, cost_date);
create index audit_unit_time on public.audit_log(business_unit_id, created_at desc);

create function private.touch_updated_at() returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'business_units','staff_allowlist','events','product_categories','products','product_costs',
    'event_products','tickets','ticket_transitions','queue_entries','orders','order_items',
    'order_item_financials','inventory_items','event_inventory','product_inventory_links',
    'order_item_inventory','inventory_movements','costs','audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('create trigger touch_updated_at before update on public.%I for each row execute function private.touch_updated_at()', table_name);
  end loop;
end;
$$;

commit;
