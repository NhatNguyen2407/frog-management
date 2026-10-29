import { getTranslations } from "next-intl/server";
import { Plus, ReceiptText } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { formatDate, formatVnd } from "@/lib/formatting";
import { subtotal } from "@/lib/domain/finance";
import type { Order, Financials } from "@/lib/supabase/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { ActionForm } from "@/components/action-form";
import { Pagination } from "@/components/pagination";
import { EmptyState, PageTitle, StatusBadge, Field } from "@/components/shared";
import { CheckoutTotal, ItemEditor } from "./item-editor";
export async function OrdersView({ page, status }: { page: number; status: string }) {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.event)
    return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")} />;
  let query = w.client
    .from("orders")
    .select("*", { count: "exact" })
    .eq("event_id", w.event.id)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("id");
  if (["paid", "unpaid", "refunded", "cancelled"].includes(status))
    query = query.eq("payment_status", status as Order["payment_status"]);
  const { data: orders, error, count } = await query.range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("app.load_failed");
  const orderIds = orders?.map((row) => row.id) ?? [];
  const ticketIds = [
    ...new Set(orders?.flatMap((row) => (row.ticket_id ? [row.ticket_id] : [])) ?? []),
  ];
  const [items, tickets] = await Promise.all([
    orderIds.length
      ? requireData(
          w.client
            .from("order_items")
            .select("*")
            .in("order_id", orderIds)
            .is("voided_at", null)
            .order("created_at"),
        )
      : Promise.resolve([]),
    ticketIds.length
      ? requireData(w.client.from("tickets").select("*").in("id", ticketIds))
      : Promise.resolve([]),
  ]);
  const chunks: string[][] = [];
  for (let index = 0; index < items.length; index += 100)
    chunks.push(items.slice(index, index + 100).map((row) => row.id));
  const financials: Financials[] = w.owner
    ? (
        await Promise.all(
          chunks.map((ids) =>
            requireData(
              w.client.from("order_item_financials").select("*").in("order_item_id", ids),
            ),
          ),
        )
      ).flat()
    : [];
  const financeMap = new Map(financials.map((row) => [row.order_item_id, row]));
  const ticketMap = new Map(tickets.map((row) => [row.id, row]));
  return (
    <>
      <PageTitle
        title={t("orders.title")}
        description={t("orders.description")}
        action={
          <Button asChild>
            <Link href="/counter">
              <Plus aria-hidden />
              {t("counter.register")}
            </Link>
          </Button>
        }
      />
      <form className="mb-5 flex items-end gap-3">
        <Field label={t("common.status")}>
          <Select name="status" defaultValue={status}>
            <option value="">{t("common.all")}</option>
            {["paid", "unpaid", "refunded", "cancelled"].map((value) => (
              <option key={value} value={value}>
                {t(`paymentStatus.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          {t("common.filter")}
        </Button>
      </form>
      {!orders?.length ? (
        <EmptyState
          title={status ? t("common.noResults") : t("orders.empty")}
          description={t("orders.emptyBody")}
        />
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const lines = items.filter((row) => row.order_id === order.id);
            const ticket = order.ticket_id ? ticketMap.get(order.ticket_id) : null;
            return (
              <Card key={order.id}>
                <CardContent>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="flex items-center gap-2 font-semibold">
                          <ReceiptText aria-hidden className="size-4 text-muted-foreground" />
                          {t("orders.number")}{" "}
                          <span className="font-mono text-sm">
                            {order.id.slice(0, 8).toUpperCase()}
                          </span>
                        </h2>
                        <StatusBadge
                          status={order.payment_status}
                          label={t(`paymentStatus.${order.payment_status}`)}
                        />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {formatDate(order.created_at, true)}
                        {order.payment_method
                          ? ` · ${t(`paymentMethod.${order.payment_method}`)}`
                          : ""}
                      </p>
                      {ticket ? (
                        <Link
                          href={`/tickets/${ticket.id}/print`}
                          className="mt-2 inline-block text-sm font-medium text-primary hover:underline"
                        >
                          {ticket.ticket_number} · {ticket.customer_name}
                        </Link>
                      ) : null}
                    </div>
                    {w.owner ? (
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">{t("common.total")}</p>
                        <p className="number mt-1 text-xl font-semibold">
                          {formatVnd(
                            subtotal(
                              lines.map((line) => ({
                                quantity: line.quantity,
                                unitPriceVnd: financeMap.get(line.id)?.unit_price_vnd ?? 0,
                                unitCostVnd: null,
                                category: line.category_code_snapshot,
                              })),
                            ),
                            w.locale,
                          )}
                        </p>
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-5 space-y-3 border-t pt-4">
                    {lines.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <div className="min-w-0">
                          <span className="font-medium">{item.name_snapshot}</span>
                          <span className="number ml-2 text-muted-foreground">
                            ×{item.quantity}
                          </span>
                          {item.options &&
                          typeof item.options === "object" &&
                          !Array.isArray(item.options) &&
                          Object.keys(item.options).length ? (
                            <p className="mt-1 break-words text-xs text-muted-foreground">
                              {Object.entries(item.options)
                                .map(
                                  ([key, value]) =>
                                    `${t.has(`options.${key}`) ? t(`options.${key}`) : key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
                                )
                                .join(" · ")}
                            </p>
                          ) : null}
                        </div>
                        {order.payment_status === "unpaid" ? (
                          <div className="flex shrink-0 gap-1">
                            <Modal
                              title={t("orders.editItem")}
                              trigger={
                                <Button variant="ghost" size="sm">
                                  {t("common.edit")}
                                </Button>
                              }
                            >
                              <ItemEditor item={item} />
                            </Modal>
                            {lines.length > 1 ? (
                              <ActionForm
                                action="orderItem"
                                variant="ghost"
                                label={t("common.remove")}
                                hidden={{
                                  id: item.id,
                                  quantity: "0",
                                  options: JSON.stringify(item.options),
                                }}
                                confirm={t("orders.removeConfirm")}
                                className="grid"
                              />
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t pt-4">
                    {order.payment_status === "unpaid" ? (
                      <>
                        <CheckoutTotal orderId={order.id} />
                        <Modal
                          title={t("orders.markPaid")}
                          trigger={<Button>{t("orders.markPaid")}</Button>}
                        >
                          <ActionForm
                            action="orderPayment"
                            label={t("orders.markPaid")}
                            hidden={{ id: order.id, status: "paid" }}
                          >
                            <Field label={t("orders.paymentMethod")}>
                              <Select name="method" required>
                                <option value="cash">{t("paymentMethod.cash")}</option>
                                <option value="bank_transfer">
                                  {t("paymentMethod.bank_transfer")}
                                </option>
                              </Select>
                            </Field>
                          </ActionForm>
                        </Modal>
                        <ActionForm
                          action="orderPayment"
                          label={t("orders.cancel")}
                          variant="ghost"
                          hidden={{ id: order.id, status: "cancelled" }}
                          confirm={t("orders.cancelConfirm")}
                          className="grid"
                        />
                      </>
                    ) : order.payment_status === "paid" ? (
                      <ActionForm
                        action="orderPayment"
                        label={t("orders.refund")}
                        variant="secondary"
                        hidden={{ id: order.id, status: "refunded" }}
                        confirm={t("orders.refundConfirm")}
                        className="grid"
                      />
                    ) : null}
                    {w.owner ? (
                      <ActionForm
                        action="orderDelete"
                        label={t("common.delete")}
                        variant="ghost"
                        hidden={{ id: order.id }}
                        confirm={t("orders.deleteConfirm")}
                        className="ml-auto grid"
                      />
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      <Pagination page={page} total={count ?? 0} pageSize={20} path="/orders" query={{ status }} />
    </>
  );
}
