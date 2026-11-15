import { notFound } from "next/navigation";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { receiptSnapshot } from "@/lib/domain/receipts";
import { OrderReceipt } from "@/features/orders/receipt";
import "@/features/orders/receipt.css";

export default async function OrderPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const [w, { id }] = await Promise.all([getWorkspace(), params]);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const { data: order, error } = await w.client
    .from("orders")
    .select("*")
    .eq("id", id)
    .eq("business_unit_id", w.unit.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error("app.load_failed");
  if (!order) notFound();
  const [event, ticket, items] = await Promise.all([
    requireData(
      w.client
        .from("events")
        .select("name,event_date")
        .eq("id", order.event_id)
        .eq("business_unit_id", w.unit.id)
        .single(),
    ),
    order.ticket_id
      ? requireData(
          w.client
            .from("tickets")
            .select("ticket_number,customer_name,phone_zalo")
            .eq("id", order.ticket_id)
            .eq("event_id", order.event_id)
            .single(),
        )
      : Promise.resolve(null),
    requireData(
      w.client
        .from("order_items")
        .select("*")
        .eq("order_id", id)
        .is("voided_at", null)
        .order("created_at")
        .order("id"),
    ),
  ]);
  const prices =
    w.owner && items.length
      ? await requireData(
          w.client
            .from("order_item_financials")
            .select("order_item_id,unit_price_vnd")
            .in(
              "order_item_id",
              items.map((item) => item.id),
            ),
        )
      : w.owner
        ? []
        : null;
  return (
    <OrderReceipt
      order={{
        id: order.id,
        created_at: order.created_at,
        payment_status: order.payment_status,
        payment_method: order.payment_method,
      }}
      event={event}
      ticket={ticket}
      snapshot={receiptSnapshot(id, items, prices)}
      canPrintCustomer={w.owner}
    />
  );
}
