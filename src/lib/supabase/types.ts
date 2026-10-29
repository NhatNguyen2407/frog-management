export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
type Base = { id: string; business_unit_id: string; created_at: string; updated_at: string };
export type Unit = {
  id: string;
  slug: string;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};
export type Membership = Pick<Unit, "id" | "slug" | "name"> & { role: "owner" | "staff" };
export type Event = Base & {
  name: string;
  event_date: string;
  status: "planned" | "active" | "completed" | "cancelled";
  capacity: number | null;
  ticket_prefix: string;
  next_ticket_number: number;
};
export type Category = Base & { code: string; name: string };
export type Product = Base & {
  category_id: string;
  sku: string;
  name: string;
  price_vnd: number;
  active: boolean;
  sold_at: string | null;
};
export type TicketStatus =
  | "registered"
  | "ticket_printed"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled";
export type Ticket = Base & {
  event_id: string;
  ticket_number: string;
  sequence_number: number;
  customer_name: string;
  phone_zalo: string | null;
  status: TicketStatus;
  print_count: number;
  created_by: string;
};
export type QueueEntry = Base & {
  event_id: string;
  ticket_id: string;
  ticket_number: string;
  sequence_number: number;
  display_name: string;
  status: TicketStatus;
  status_changed_at: string;
};
export type Order = Base & {
  event_id: string;
  ticket_id: string | null;
  payment_status: "paid" | "unpaid" | "refunded" | "cancelled";
  payment_method: "cash" | "bank_transfer" | null;
  paid_at: string | null;
  request_id: string;
  created_by: string;
  deleted_at: string | null;
};
export type OrderItem = Base & {
  event_id: string;
  order_id: string;
  product_id: string;
  sku_snapshot: string;
  name_snapshot: string;
  category_code_snapshot: string;
  quantity: number;
  options: Json;
  voided_at: string | null;
};
export type Financials = Base & {
  event_id: string;
  order_item_id: string;
  unit_price_vnd: number;
  unit_cost_vnd: number | null;
};
export type InventoryStatus = {
  business_unit_id: string;
  event_id: string;
  event_inventory_id: string;
  inventory_item_id: string;
  name: string;
  spec: string;
  stock_prepared: number | null;
  low_stock_threshold: number;
  stock_used: number;
  stock_remaining: number | null;
  stock_status: "ok" | "low" | "out" | "not_entered";
  manual_adjustments: number;
};
export type Cost = Base & {
  event_id: string;
  category: string;
  amount_vnd: number;
  note: string | null;
  cost_date: string;
  created_by: string;
};
export type EventFinancials = {
  event_id: string;
  business_unit_id: string;
  event_name: string;
  event_date: string;
  revenue_vnd: number;
  workshop_revenue_vnd: number;
  food_beverage_revenue_vnd: number;
  cost_of_goods_vnd: number;
  event_costs_vnd: number;
  total_costs_vnd: number;
  missing_unit_cost_count: number;
  profit_vnd: number | null;
  margin_percent: number | null;
  paid_order_count: number;
  unpaid_order_count: number;
  items_sold: number;
};
export type ProductRevenue = {
  business_unit_id: string;
  event_id: string;
  product_id: string;
  sku_snapshot: string;
  name_snapshot: string;
  category_code_snapshot: string;
  items_sold: number;
  revenue_vnd: number;
  revenue_percent: number;
};
export type Operations = {
  business_unit_id: string;
  event_id: string;
  registered_count: number;
  printed_count: number;
  waiting_count: number;
  in_progress_count: number;
  completed_count: number;
  cancelled_count: number;
};
export type CheckoutResult = {
  order_id: string;
  ticket_id: string | null;
  ticket_number?: string;
  total_vnd?: number;
  already_created?: boolean;
};
type Table<T> = { Row: T; Insert: Partial<T>; Update: Partial<T>; Relationships: [] };
type View<T> = { Row: T; Relationships: [] };
type Fn<A, R> = { Args: A; Returns: R };
export type Database = {
  public: {
    Tables: {
      business_units: Table<Unit>;
      events: Table<Event>;
      product_categories: Table<Category>;
      products: Table<Product>;
      staff_allowlist: Table<Base & { email: string; role: "owner" | "staff"; active: boolean }>;
      product_costs: Table<Base & { product_id: string; unit_cost_vnd: number | null }>;
      event_products: Table<Base & { event_id: string; product_id: string; active: boolean }>;
      tickets: Table<Ticket>;
      queue_entries: Table<QueueEntry>;
      orders: Table<Order>;
      order_items: Table<OrderItem>;
      ticket_transitions: Table<
        Base & {
          event_id: string;
          ticket_id: string;
          from_status: TicketStatus | null;
          to_status: TicketStatus;
          changed_by: string;
        }
      >;
      order_item_financials: Table<Financials>;
      costs: Table<Cost>;
      inventory_items: Table<Base & { name: string; spec: string; active: boolean }>;
      event_inventory: Table<
        Base & {
          event_id: string;
          inventory_item_id: string;
          stock_prepared: number | null;
          low_stock_threshold: number;
        }
      >;
      product_inventory_links: Table<
        Base & {
          event_id: string;
          product_id: string;
          event_inventory_id: string;
          quantity_per_unit: number;
          active: boolean;
        }
      >;
    };
    Views: {
      event_financials: View<EventFinancials>;
      product_revenue: View<ProductRevenue>;
      inventory_status: View<InventoryStatus>;
      revenue_over_time: View<{
        business_unit_id: string;
        event_id: string;
        local_hour: string;
        revenue_vnd: number;
      }>;
      operations_summary: View<Operations>;
    };
    Functions: {
      get_access_context: Fn<Record<string, never>, Json>;
      create_event: Fn<
        {
          p_unit: string;
          p_name: string;
          p_date: string;
          p_capacity: number | null;
          p_prefix: string;
        },
        string
      >;
      save_product: Fn<
        {
          p_unit: string;
          p_product_id: string | null;
          p_category: string;
          p_sku: string;
          p_name: string;
          p_price: number;
          p_cost: number | null;
          p_active: boolean;
        },
        string
      >;
      create_order: Fn<
        {
          p_event: string;
          p_request_id: string;
          p_items: Json;
          p_register_ticket?: boolean;
          p_customer_name?: string | null;
          p_phone_zalo?: string | null;
          p_ticket_id?: string | null;
          p_paid?: boolean;
          p_method?: "cash" | "bank_transfer" | null;
        },
        Json
      >;
      set_ticket_status: Fn<{ p_ticket_id: string; p_status: TicketStatus }, undefined>;
      record_ticket_print: Fn<{ p_ticket_id: string }, number>;
      set_order_payment: Fn<
        {
          p_order_id: string;
          p_status: Order["payment_status"];
          p_method?: Order["payment_method"];
        },
        undefined
      >;
      update_order_item: Fn<{ p_item_id: string; p_quantity: number; p_options: Json }, undefined>;
      soft_delete_order: Fn<{ p_order_id: string }, undefined>;
      get_order_checkout: Fn<{ p_order_id: string }, Json>;
      save_inventory: Fn<
        {
          p_unit: string;
          p_event: string;
          p_id: string | null;
          p_name: string;
          p_spec: string;
          p_prepared: number | null;
          p_threshold: number;
        },
        string
      >;
    };
    Enums: {
      staff_role: "owner" | "staff";
      ticket_status: TicketStatus;
      payment_status: Order["payment_status"];
      payment_method: NonNullable<Order["payment_method"]>;
      event_status: Event["status"];
    };
    CompositeTypes: Record<string, never>;
  };
};
