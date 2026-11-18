import type { Product, Ticket } from "../../lib/supabase/types.ts";

export type CounterDraft = {
  version: 1;
  items: { id: string; productId: string; quantity: number; options: Record<string, string> }[];
  ticketMode: string;
  customerName: string;
  phone: string;
  ticketId: string;
  payment: string;
  method: string;
  requestId: string | null;
};
export function emptyDraft(): CounterDraft {
  return {
    version: 1,
    items: [],
    ticketMode: "new",
    customerName: "",
    phone: "",
    ticketId: "",
    payment: "unpaid",
    method: "cash",
    requestId: null,
  };
}
export function readDraft(
  raw: string | null,
  products: Product[],
  tickets: Ticket[],
): CounterDraft {
  const empty = emptyDraft();
  if (!raw) return empty;
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    return empty;
  }
  if (!value || value.version !== 1 || !Array.isArray(value.items)) return empty;
  const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
  const ids = new Set<string>();
  const items: CounterDraft["items"] = [];
  for (const item of value.items) {
    if (
      !item ||
      typeof item.id !== "string" ||
      ids.has(item.id) ||
      !products.some((p) => p.id === item.productId && p.active) ||
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 999 ||
      !item.options ||
      typeof item.options !== "object" ||
      Array.isArray(item.options)
    )
      continue;
    ids.add(item.id);
    const options = Object.fromEntries(
      Object.entries(item.options).filter(
        ([key, val]) =>
          key.length <= 60 &&
          !["__proto__", "constructor", "prototype"].includes(key) &&
          typeof val === "string" &&
          val.length <= 2000,
      ),
    );
    items.push({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      options: options as Record<string, string>,
    });
  }
  const ticketId = tickets.some((t) => t.id === value.ticketId && t.status !== "cancelled")
    ? value.ticketId
    : "";
  const restored: CounterDraft = {
    version: 1,
    items,
    ticketMode: ["new", "existing", "none"].includes(value.ticketMode) ? value.ticketMode : "new",
    customerName: text(value.customerName, 150),
    phone: text(value.phone, 50),
    ticketId,
    payment: value.payment === "paid" ? "paid" : "unpaid",
    method: value.method === "bank_transfer" ? "bank_transfer" : "cash",
    requestId:
      typeof value.requestId === "string" && /^[0-9a-f-]{36}$/i.test(value.requestId)
        ? value.requestId
        : null,
  };
  // A changed catalogue/ticket must start a new checkout attempt.
  if (
    JSON.stringify({ ...restored, requestId: null }) !==
    JSON.stringify({ ...value, requestId: null })
  )
    restored.requestId = null;
  return restored;
}
