import { getTranslations } from "next-intl/server";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { csvChunks, reportRange, type CsvRecord } from "@/lib/domain/reporting";
import { formatDate } from "@/lib/formatting";

export async function GET(request: Request) {
  const w = await getWorkspace();
  const t = await getTranslations({ locale: w.locale });
  const noStore = { "Cache-Control": "private, no-store" };
  if (!w.owner) return new Response(t("errors.owner_required"), { status: 403, headers: noStore });
  const query = new URL(request.url).searchParams;
  const kind = query.get("type");
  if (kind !== "orders" && kind !== "revenue" && kind !== "expenses")
    return new Response(t("errors.invalid_request"), { status: 400, headers: noStore });
  const eventId = query.get("event") ?? "";
  if (eventId && !w.events.some((event) => event.id === eventId))
    return new Response(t("errors.not_allowed"), { status: 400, headers: noStore });
  let range: ReturnType<typeof reportRange>;
  try {
    range = reportRange(query.get("from") ?? "", query.get("to") ?? "");
  } catch {
    return new Response(t("errors.invalid_date_range"), { status: 400, headers: noStore });
  }
  const columns =
    kind === "orders"
      ? [
          "date",
          "workshop",
          "order",
          "customer",
          "phone",
          "ticket",
          "status",
          "method",
          "items",
          "total",
        ]
      : kind === "revenue"
        ? [
            "date",
            "workshop",
            "order",
            "customer",
            "sku",
            "product",
            "category",
            "quantity",
            "price",
            "revenue",
            "cogs",
          ]
        : ["date", "workshop", "expense", "category", "note", "amount"];

  // shortcut: exports read live pages; use a database snapshot if concurrent edits must not affect a report.
  async function load(cursor: string | null): Promise<CsvRecord[]> {
    if (kind === "expenses") {
      let q = w.client
        .from("expense_report")
        .select("*")
        .eq("business_unit_id", w.unit.id)
        .order("id")
        .limit(1000)
        .abortSignal(request.signal);
      if (eventId) q = q.eq("event_id", eventId);
      if (range.from) q = q.gte("cost_date", range.from);
      if (range.to) q = q.lte("cost_date", range.to);
      if (cursor) q = q.gt("id", cursor);
      return (await requireData(q)).map((row) => ({
        id: row.id,
        values: [
          formatDate(row.cost_date),
          row.event_name,
          row.id,
          row.category,
          row.note,
          row.amount_vnd,
        ],
      }));
    }
    if (kind === "revenue") {
      let q = w.client
        .from("sales_report_lines")
        .select("*")
        .eq("business_unit_id", w.unit.id)
        .order("order_item_id")
        .limit(1000)
        .abortSignal(request.signal);
      if (eventId) q = q.eq("event_id", eventId);
      if (range.start) q = q.gte("paid_at", range.start);
      if (range.end) q = q.lte("paid_at", range.end);
      if (cursor) q = q.gt("order_item_id", cursor);
      return (await requireData(q)).map((row) => ({
        id: row.order_item_id,
        values: [
          formatDate(row.paid_at, true),
          row.event_name,
          row.order_id,
          row.customer_name,
          row.sku_snapshot,
          row.name_snapshot,
          row.category_code_snapshot,
          row.quantity,
          row.unit_price_vnd,
          row.revenue_vnd,
          row.cost_of_goods_vnd,
        ],
      }));
    }
    let q = w.client
      .from("customer_history")
      .select("*")
      .eq("business_unit_id", w.unit.id)
      .order("id")
      .limit(1000)
      .abortSignal(request.signal);
    if (eventId) q = q.eq("event_id", eventId);
    if (range.start) q = q.gte("created_at", range.start);
    if (range.end) q = q.lte("created_at", range.end);
    if (cursor) q = q.gt("id", cursor);
    return (await requireData(q)).map((row) => ({
      id: row.id,
      values: [
        formatDate(row.created_at, true),
        row.event_name,
        row.id,
        row.customer_name,
        row.phone_zalo,
        row.ticket_number,
        t(`paymentStatus.${row.payment_status}`),
        row.payment_method ? t(`paymentMethod.${row.payment_method}`) : "",
        row.items.map((item) => `${item.name} x${item.quantity}`).join(", "),
        row.total_vnd,
      ],
    }));
  }
  const chunks = csvChunks(
    columns.map((column) => t(`reports.columns.${column}`)),
    load,
  );
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const chunk = await chunks.next();
        if (chunk.done) controller.close();
        else controller.enqueue(encoder.encode(chunk.value));
      } catch {
        controller.error(new Error("app.export_failed"));
      }
    },
    async cancel() {
      await chunks.return(undefined);
    },
  });
  return new Response(stream, {
    headers: {
      ...noStore,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="frog-${kind}-${range.from || "all"}-${range.to || "all"}.csv"`,
    },
  });
}
