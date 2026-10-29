"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getWorkspace } from "@/lib/permissions/context";
import type { CheckoutResult, Json, Order, TicketStatus, Event } from "@/lib/supabase/types";

export type ActionName =
  | "context"
  | "eventCreate"
  | "eventUpdate"
  | "productSave"
  | "orderCreate"
  | "ticketStatus"
  | "ticketPrint"
  | "orderPayment"
  | "orderItem"
  | "orderDelete"
  | "checkout"
  | "inventorySave"
  | "inventoryMapping"
  | "mappingDisable"
  | "costSave"
  | "allowlistSave";
export type ActionResult = {
  ok: boolean;
  error?: string;
  checkout?: CheckoutResult;
  printCount?: number;
};
const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();
function number(form: FormData, key: string, nullable = false) {
  const input = text(form, key);
  if (!input && nullable) return null;
  const value = Number(input);
  if (!input || !Number.isFinite(value) || value < 0) throw new Error("app.invalid_request");
  return value;
}
function choice<T extends string>(value: string, allowed: readonly T[]): T {
  if (!allowed.includes(value as T)) throw new Error("app.invalid_request");
  return value as T;
}
function json(form: FormData, key: string): Json {
  try {
    return JSON.parse(text(form, key) || "{}");
  } catch {
    throw new Error("app.invalid_request");
  }
}
function normalizedError(error: { message?: string; code?: string }) {
  if (error.code === "23505") return "duplicate";
  return (
    error.message?.match(/app\.([a-z_]+)/)?.[1] ??
    (error.code === "42501" ? "not_allowed" : "generic")
  );
}

export async function mutate(action: ActionName, form: FormData): Promise<ActionResult> {
  const workspace = await getWorkspace();
  const { client, unit, owner, event } = workspace;
  const ownerActions: ActionName[] = [
    "eventCreate",
    "eventUpdate",
    "productSave",
    "orderDelete",
    "inventorySave",
    "inventoryMapping",
    "mappingDisable",
    "costSave",
    "allowlistSave",
  ];
  if (ownerActions.includes(action) && !owner) return { ok: false, error: "owner_required" };
  const eventId = text(form, "event_id") || event?.id;
  if (eventId && !workspace.events.some((row) => row.id === eventId))
    return { ok: false, error: "not_allowed" };
  try {
    let result: { error: { message?: string; code?: string } | null; data?: unknown };
    switch (action) {
      case "context": {
        const chosenUnit = text(form, "unit_id") || unit.id;
        if (!workspace.units.some((row) => row.id === chosenUnit))
          return { ok: false, error: "not_allowed" };
        const store = await cookies();
        const opts = {
          httpOnly: true,
          sameSite: "lax" as const,
          secure: process.env.NODE_ENV === "production",
          path: "/",
          maxAge: 31536000,
        };
        store.set("frog-unit", chosenUnit, opts);
        store.set("frog-event", text(form, "selected_event"), opts);
        result = { error: null };
        break;
      }
      case "eventCreate":
        result = await client.rpc("create_event", {
          p_unit: unit.id,
          p_name: text(form, "name"),
          p_date: text(form, "date"),
          p_capacity: number(form, "capacity", true),
          p_prefix: text(form, "prefix"),
        });
        break;
      case "eventUpdate":
        result = await client
          .from("events")
          .update({
            name: text(form, "name"),
            event_date: text(form, "date"),
            capacity: number(form, "capacity", true),
            ticket_prefix: text(form, "prefix"),
            status: choice<Event["status"]>(text(form, "status"), [
              "planned",
              "active",
              "completed",
              "cancelled",
            ]),
          })
          .eq("id", text(form, "id"))
          .eq("business_unit_id", unit.id);
        break;
      case "productSave":
        result = await client.rpc("save_product", {
          p_unit: unit.id,
          p_product_id: text(form, "id") || null,
          p_category: text(form, "category_id"),
          p_sku: text(form, "sku"),
          p_name: text(form, "name"),
          p_price: number(form, "price")!,
          p_cost: number(form, "cost", true),
          p_active: form.has("active"),
        });
        break;
      case "orderCreate": {
        if (!eventId) return { ok: false, error: "event_not_active" };
        const method = text(form, "method");
        result = await client.rpc("create_order", {
          p_event: eventId,
          p_request_id: text(form, "request_id"),
          p_items: json(form, "items"),
          p_register_ticket: form.has("register_ticket"),
          p_customer_name: text(form, "customer_name") || null,
          p_phone_zalo: text(form, "phone_zalo") || null,
          p_ticket_id: text(form, "ticket_id") || null,
          p_paid: text(form, "payment_status") === "paid",
          p_method: method ? choice(method, ["cash", "bank_transfer"] as const) : null,
        });
        if (!result.error) {
          revalidatePath("/", "layout");
          return { ok: true, checkout: result.data as CheckoutResult };
        }
        break;
      }
      case "ticketStatus":
        result = await client.rpc("set_ticket_status", {
          p_ticket_id: text(form, "id"),
          p_status: choice<TicketStatus>(text(form, "status"), [
            "registered",
            "ticket_printed",
            "waiting",
            "in_progress",
            "completed",
            "cancelled",
          ]),
        });
        break;
      case "ticketPrint": {
        result = await client.rpc("record_ticket_print", { p_ticket_id: text(form, "id") });
        if (!result.error) {
          revalidatePath("/", "layout");
          return { ok: true, printCount: result.data as number };
        }
        break;
      }
      case "orderPayment":
        result = await client.rpc("set_order_payment", {
          p_order_id: text(form, "id"),
          p_status: choice<Order["payment_status"]>(text(form, "status"), [
            "paid",
            "unpaid",
            "refunded",
            "cancelled",
          ]),
          p_method: text(form, "method")
            ? choice(text(form, "method"), ["cash", "bank_transfer"] as const)
            : null,
        });
        break;
      case "orderItem":
        result = await client.rpc("update_order_item", {
          p_item_id: text(form, "id"),
          p_quantity: number(form, "quantity")!,
          p_options: json(form, "options"),
        });
        break;
      case "orderDelete":
        result = await client.rpc("soft_delete_order", { p_order_id: text(form, "id") });
        break;
      case "checkout": {
        result = await client.rpc("get_order_checkout", { p_order_id: text(form, "id") });
        if (!result.error) return { ok: true, checkout: result.data as CheckoutResult };
        break;
      }
      case "inventorySave": {
        if (!eventId) return { ok: false, error: "not_found" };
        result = await client.rpc("save_inventory", {
          p_unit: unit.id,
          p_event: eventId,
          p_id: text(form, "id") || null,
          p_name: text(form, "name"),
          p_spec: text(form, "spec"),
          p_prepared: number(form, "prepared", true),
          p_threshold: number(form, "threshold")!,
        });
        break;
      }
      case "inventoryMapping": {
        if (!eventId) return { ok: false, error: "not_found" };
        result = await client.from("product_inventory_links").upsert(
          {
            business_unit_id: unit.id,
            event_id: eventId,
            product_id: text(form, "product_id"),
            event_inventory_id: text(form, "stock_id"),
            quantity_per_unit: number(form, "per_unit")!,
            active: true,
          },
          { onConflict: "event_id,product_id,event_inventory_id" },
        );
        break;
      }
      case "mappingDisable":
        result = await client
          .from("product_inventory_links")
          .update({ active: false })
          .eq("id", text(form, "id"))
          .eq("business_unit_id", unit.id);
        break;
      case "costSave": {
        if (!eventId) return { ok: false, error: "not_found" };
        result = await client.from("costs").insert({
          business_unit_id: unit.id,
          event_id: eventId,
          category: text(form, "category"),
          amount_vnd: number(form, "amount")!,
          note: text(form, "note") || null,
          cost_date: text(form, "date"),
          created_by: workspace.user.id,
        });
        break;
      }
      case "allowlistSave": {
        const role = choice(text(form, "role"), ["owner", "staff"] as const);
        result = await client.from("staff_allowlist").upsert(
          {
            business_unit_id: unit.id,
            email: text(form, "email").toLowerCase(),
            role,
            active: form.has("active"),
          },
          { onConflict: "business_unit_id,email" },
        );
        break;
      }
      default:
        return { ok: false, error: "invalid_request" };
    }
    if (result.error) return { ok: false, error: normalizedError(result.error) };
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: normalizedError(error instanceof Error ? error : {}) };
  }
}
