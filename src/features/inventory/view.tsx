import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import type { InventoryStatus } from "@/lib/supabase/types";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Modal } from "@/components/ui/dialog";
import { ActionForm } from "@/components/action-form";
import { EmptyState, Field, Notice, PageTitle, StatusBadge } from "@/components/shared";
type T = Awaited<ReturnType<typeof getTranslations>>;
function InventoryFields({ row, t }: { row?: InventoryStatus; t: T }) {
  return (
    <>
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={row?.name} required maxLength={150} />
      </Field>
      <Field label={t("inventory.spec")}>
        <Input name="spec" defaultValue={row?.spec} maxLength={300} />
      </Field>
      <Field label={t("inventory.prepared")} help={t("inventory.preparedHelp")}>
        <Input
          name="prepared"
          type="number"
          min={0}
          max={999999999}
          step="0.001"
          defaultValue={row?.stock_prepared ?? ""}
        />
      </Field>
      <Field label={t("inventory.threshold")}>
        <Input
          name="threshold"
          type="number"
          min={0}
          max={999999999}
          step="0.001"
          defaultValue={row?.low_stock_threshold ?? 0}
          required
        />
      </Field>
    </>
  );
}
export async function InventoryView() {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  if (!w.event)
    return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")} />;
  const [rows, products, mappings] = await Promise.all([
    requireData(
      w.client.from("inventory_status").select("*").eq("event_id", w.event.id).order("name"),
    ),
    requireData(
      w.client.from("products").select("*").eq("business_unit_id", w.unit.id).order("name"),
    ),
    requireData(
      w.client
        .from("product_inventory_links")
        .select("*")
        .eq("event_id", w.event.id)
        .eq("active", true),
    ),
  ]);
  const format = (value: number | string | null) =>
    value === null
      ? t("common.unset")
      : new Intl.NumberFormat(w.locale, { maximumFractionDigits: 3 }).format(Number(value));
  return (
    <>
      <PageTitle
        title={t("inventory.title")}
        description={t("inventory.description")}
        action={
          <Modal
            title={t("inventory.add")}
            trigger={
              <Button>
                <Plus aria-hidden />
                {t("inventory.add")}
              </Button>
            }
          >
            <ActionForm
              action="inventorySave"
              label={t("inventory.add")}
              hidden={{ event_id: w.event.id }}
            >
              <InventoryFields t={t} />
            </ActionForm>
          </Modal>
        }
      />
      {rows.some((row) => row.stock_prepared === null) ? (
        <Notice>{t("inventory.missing")}</Notice>
      ) : null}
      {!rows.length ? (
        <EmptyState title={t("inventory.empty")} description={t("inventory.emptyBody")} />
      ) : (
        <Card className="overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    "common.name",
                    "inventory.spec",
                    "inventory.prepared",
                    "inventory.used",
                    "inventory.remaining",
                    "common.status",
                    "common.actions",
                  ].map((key) => (
                    <th key={key}>{t(key)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.event_inventory_id}>
                    <td className="font-medium">{row.name}</td>
                    <td className="text-muted-foreground">{row.spec}</td>
                    <td className="number">{format(row.stock_prepared)}</td>
                    <td className="number">{format(row.stock_used)}</td>
                    <td className="number font-semibold">{format(row.stock_remaining)}</td>
                    <td>
                      <StatusBadge
                        status={row.stock_status}
                        label={t(`stockStatus.${row.stock_status}`)}
                      />
                    </td>
                    <td>
                      <Modal
                        title={t("inventory.edit")}
                        trigger={<Button variant="ghost">{t("common.edit")}</Button>}
                      >
                        <ActionForm
                          action="inventorySave"
                          label={t("common.save")}
                          hidden={{ id: row.inventory_item_id, event_id: w.event!.id }}
                        >
                          <InventoryFields row={row} t={t} />
                        </ActionForm>
                      </Modal>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {rows.length ? (
        <Card className="mt-7">
          <CardHeader>
            <h2 className="font-semibold">{t("inventory.mappingTitle")}</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {t("inventory.mappingBody")}
            </p>
          </CardHeader>
          <CardContent>
            <ActionForm
              action="inventoryMapping"
              label={t("inventory.saveMapping")}
              hidden={{ event_id: w.event.id }}
              className="grid items-end gap-4 md:grid-cols-4"
            >
              <Field label={t("inventory.product")}>
                <Select name="product_id" required>
                  <option value="">{t("common.choose")}</option>
                  {products.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name} · {row.sku}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("inventory.supply")}>
                <Select name="stock_id" required>
                  <option value="">{t("common.choose")}</option>
                  {rows.map((row) => (
                    <option key={row.event_inventory_id} value={row.event_inventory_id}>
                      {row.name} {row.spec}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t("inventory.perUnit")}>
                <Input
                  name="per_unit"
                  required
                  type="number"
                  min="0.001"
                  step="0.001"
                  max="999999"
                  defaultValue={1}
                />
              </Field>
            </ActionForm>
            <div className="mt-6 space-y-3">
              {!mappings.length ? (
                <p className="text-sm text-muted-foreground">{t("inventory.mappingEmpty")}</p>
              ) : (
                mappings.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-sm"
                  >
                    <span>
                      <strong>
                        {products.find((product) => product.id === row.product_id)?.name}
                      </strong>
                      <span className="mx-2 text-muted-foreground">→</span>
                      {
                        rows.find((stock) => stock.event_inventory_id === row.event_inventory_id)
                          ?.name
                      }
                      <span className="number ml-2 text-muted-foreground">
                        ×{format(row.quantity_per_unit)}
                      </span>
                    </span>
                    <ActionForm
                      action="mappingDisable"
                      label={t("inventory.disableMapping")}
                      variant="ghost"
                      hidden={{ id: row.id }}
                      confirm={t("inventory.disableConfirm")}
                      className="grid"
                    />
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );
}
