import { getTranslations } from "next-intl/server";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { formatDate } from "@/lib/formatting";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { ActionForm } from "@/components/action-form";
import { EmptyState, Notice, PageTitle, StatusBadge } from "@/components/shared";
import { MaterialsView } from "./materials";
import { StockEditor } from "./stock-editor";
export async function InventoryView() {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  if (!w.event)
    return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")} />;
  const [stocks, products, movements] = await Promise.all([
    requireData(w.client.rpc("get_product_stock", { p_event: w.event.id })),
    requireData(
      w.client.from("products").select("*").eq("business_unit_id", w.unit.id).order("name"),
    ),
    requireData(
      w.client
        .from("inventory_movements")
        .select("*")
        .eq("event_id", w.event.id)
        .not("product_id", "is", null)
        .order("created_at", { ascending: false })
        .order("id")
        .limit(30),
    ),
  ]);
  const rows = products.flatMap((product) => {
    const stock = stocks.find((s) => s.product_id === product.id);
    return stock ? [{ ...product, ...stock }] : [];
  });
  const low = rows.filter(
    (r) => r.stock_remaining !== null && r.stock_remaining <= r.low_stock_threshold,
  ).length;
  const format = (n: number | null) =>
    n === null
      ? t("common.unset")
      : new Intl.NumberFormat(w.locale, { maximumFractionDigits: 3 }).format(n);
  return (
    <>
      <PageTitle
        title={t("inventory.title")}
        description={t("inventory.productDescription")}
        action={<Badge>{t("inventory.lowCount", { count: low })}</Badge>}
      />
      {rows.some((r) => r.stock_remaining === null) ? (
        <Notice>{t("inventory.setupHelp")}</Notice>
      ) : null}
      {rows.some((r) => r.stock_remaining !== null && r.stock_remaining < 0) ? (
        <Notice variant="error">{t("inventory.negativeHelp")}</Notice>
      ) : null}
      {!rows.length ? (
        <EmptyState
          title={t("inventory.productsEmpty")}
          description={t("inventory.productsEmptyBody")}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "inventory.product",
                    "products.sku",
                    "inventory.remaining",
                    "inventory.threshold",
                    "common.status",
                    "common.actions",
                  ].map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status =
                    row.stock_remaining === null
                      ? "not_entered"
                      : row.stock_remaining <= 0
                        ? "out"
                        : row.stock_remaining <= row.low_stock_threshold
                          ? "low"
                          : "ok";
                  return (
                    <tr key={row.id}>
                      <td className="font-medium">{row.name}</td>
                      <td className="font-mono text-xs text-muted-foreground">{row.sku}</td>
                      <td className="number text-lg font-semibold">
                        {row.stock_remaining === null
                          ? t("inventory.notConfigured")
                          : format(row.stock_remaining)}
                      </td>
                      <td className="number">{format(row.low_stock_threshold)}</td>
                      <td>
                        <StatusBadge status={status} label={t(`stockStatus.${status}`)} />
                      </td>
                      <td>
                        {row.editable ? (
                          <Modal
                            title={`${t("inventory.editStock")} · ${row.name}`}
                            description={t("inventory.currentStock", {
                              count:
                                row.stock_remaining === null
                                  ? t("inventory.notConfigured")
                                  : format(row.stock_remaining),
                            })}
                            trigger={
                              <Button variant="secondary">{t("inventory.editStock")}</Button>
                            }
                          >
                            <ActionForm
                              action="productStock"
                              label={t("common.confirm")}
                              hidden={{
                                event_id: w.event!.id,
                                product_id: row.id,
                                expected:
                                  row.stock_remaining === null ? "" : String(row.stock_remaining),
                                request_id: crypto.randomUUID(),
                              }}
                            >
                              <StockEditor
                                remaining={row.stock_remaining}
                                threshold={row.low_stock_threshold}
                              />
                            </ActionForm>
                          </Modal>
                        ) : (
                          <a className="text-sm text-primary underline" href="#advanced-materials">
                            {t("inventory.sharedStock")}
                          </a>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      <Card className="mt-7 overflow-hidden">
        <CardHeader>
          <h2 className="font-semibold">{t("inventory.history")}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{t("inventory.historyHelp")}</p>
        </CardHeader>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {[
                  "common.date",
                  "inventory.product",
                  "inventory.movement",
                  "inventory.quantity",
                  "inventory.beforeAfter",
                  "inventory.reason",
                ].map((key) => (
                  <th key={key}>{t(key)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {movements.length ? (
                movements.map((row) => (
                  <tr key={row.id}>
                    <td>{formatDate(row.created_at, true)}</td>
                    <td>{products.find((p) => p.id === row.product_id)?.name}</td>
                    <td>{row.stock_kind ? t(`inventory.kinds.${row.stock_kind}`) : row.reason}</td>
                    <td className="number">
                      {(row.product_quantity_delta ?? 0) > 0 ? "+" : ""}
                      {format(row.product_quantity_delta)}
                    </td>
                    <td className="number">
                      {format(row.stock_before)} → {format(row.stock_after)}
                    </td>
                    <td>{row.note ?? (row.order_item_id ? t("inventory.orderMovement") : "")}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-muted-foreground">
                    {t("inventory.historyEmpty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <details id="advanced-materials" className="mt-7 rounded-2xl border p-5">
        <summary className="cursor-pointer font-medium">{t("inventory.advanced")}</summary>
        <p className="my-4 text-sm text-muted-foreground">{t("inventory.advancedHelp")}</p>
        <MaterialsView />
      </details>
    </>
  );
}
