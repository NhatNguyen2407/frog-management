import { getTranslations } from "next-intl/server";
import { Plus, CalendarDays, LockKeyhole, Search } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { formatDate, formatVnd, todayInVietnam } from "@/lib/formatting";
import { ActionForm } from "@/components/action-form";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Field, PageTitle, StatusBadge, Notice } from "@/components/shared";
import type { Event, Product, Category } from "@/lib/supabase/types";

type T = Awaited<ReturnType<typeof getTranslations>>;
function EventFields({ row, t }: { row?: Event; t: T }) {
  return (
    <>
      <Field label={t("events.name")}>
        <Input name="name" defaultValue={row?.name} required maxLength={200} />
      </Field>
      <Field label={t("common.date")}>
        <Input
          name="date"
          type="date"
          defaultValue={row?.event_date ?? todayInVietnam()}
          required
        />
      </Field>
      <Field label={t("events.capacity")} help={t("events.capacityHelp")}>
        <Input
          name="capacity"
          type="number"
          min={1}
          max={100000}
          defaultValue={row?.capacity ?? ""}
        />
      </Field>
      <Field label={t("events.prefix")} help={t("events.prefixHelp")}>
        <Input
          name="prefix"
          pattern="[A-Z0-9]{1,12}"
          defaultValue={row?.ticket_prefix ?? t("events.defaultPrefix")}
          readOnly={!!row && row.next_ticket_number > 1}
          required
          maxLength={12}
        />
      </Field>
      {row ? (
        <Field label={t("common.status")}>
          <Select name="status" defaultValue={row.status}>
            {["planned", "active", "completed", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {t(`eventStatus.${status}`)}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
    </>
  );
}
export async function EventsView() {
  const [t, { events, event, owner }] = await Promise.all([getTranslations(), getWorkspace()]);
  if (!owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  const create = (
    <Modal
      title={t("events.create")}
      trigger={
        <Button>
          <Plus aria-hidden />
          {t("events.create")}
        </Button>
      }
    >
      <ActionForm action="eventCreate" label={t("events.create")}>
        <EventFields t={t} />
      </ActionForm>
    </Modal>
  );
  return (
    <>
      <PageTitle title={t("events.title")} description={t("events.description")} action={create} />
      {!events.length ? (
        <EmptyState title={t("events.empty")} description={t("events.emptyBody")} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {events.map((row) => (
            <Card
              key={row.id}
              className={row.id === event?.id ? "border-primary/40 ring-1 ring-primary/10" : ""}
            >
              <CardContent>
                <div className="mb-5 flex items-start justify-between gap-3">
                  <div className="rounded-xl bg-muted p-2.5">
                    <CalendarDays className="size-5 text-primary" aria-hidden />
                  </div>
                  <StatusBadge status={row.status} label={t(`eventStatus.${row.status}`)} />
                </div>
                <h2 className="font-semibold">{row.name}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{formatDate(row.event_date)}</p>
                <div className="mt-5 flex items-center justify-between border-t pt-4 text-xs text-muted-foreground">
                  <span>
                    {t("events.prefix")}:{" "}
                    <strong className="text-foreground">{row.ticket_prefix}</strong>
                  </span>
                  <span>
                    {t("events.capacity")}: {row.capacity ?? t("common.none")}
                  </span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <ActionForm
                    action="context"
                    label={t(row.id === event?.id ? "events.selected" : "events.select")}
                    variant={row.id === event?.id ? "secondary" : "default"}
                    hidden={{ selected_event: row.id }}
                    className="grid"
                  />
                  <Modal
                    title={t("events.edit")}
                    trigger={<Button variant="ghost">{t("common.edit")}</Button>}
                  >
                    <ActionForm
                      action="eventUpdate"
                      label={t("common.save")}
                      hidden={{ id: row.id }}
                      confirm={t("events.archiveConfirm")}
                    >
                      <EventFields row={row} t={t} />
                    </ActionForm>
                  </Modal>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
function ProductFields({
  row,
  categories,
  cost,
  t,
}: {
  row?: Product;
  categories: Category[];
  cost?: number | null;
  t: T;
}) {
  return (
    <>
      <Field label={t("common.name")}>
        <Input name="name" defaultValue={row?.name} required maxLength={200} />
      </Field>
      <Field label={t("products.sku")}>
        <Input
          name="sku"
          defaultValue={row?.sku}
          pattern="[A-Z0-9][A-Z0-9_\-]{0,63}"
          readOnly={!!row?.sold_at}
          required
          maxLength={64}
        />
      </Field>
      <Field label={t("common.category")}>
        <Select
          name="category_id"
          defaultValue={row?.category_id ?? categories[0]?.id}
          aria-readonly={!!row?.sold_at}
        >
          {categories
            .filter((category) => !row?.sold_at || category.id === row.category_id)
            .map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-4">
        <Field label={t("products.priceVnd")}>
          <Input
            name="price"
            type="number"
            min={0}
            max={1000000000}
            step={1}
            defaultValue={row?.price_vnd}
            readOnly={!!row?.sold_at}
            required
          />
        </Field>
        <Field label={t("products.costVnd")}>
          <Input
            name="cost"
            type="number"
            min={0}
            max={1000000000}
            step={1}
            defaultValue={cost ?? ""}
          />
        </Field>
      </div>
      <p className="text-xs leading-relaxed text-muted-foreground">{t("products.costHelp")}</p>
      {!row || row.active ? <input type="hidden" name="active" value="on" /> : null}
      {row?.sold_at ? <Notice variant="info">{t("products.lockedHelp")}</Notice> : null}
    </>
  );
}
export async function ProductsView({
  query,
  category,
  eventOnly,
}: {
  query: string;
  category: string;
  eventOnly: boolean;
}) {
  const [t, w] = await Promise.all([getTranslations(), getWorkspace()]);
  if (!w.owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  const [products, categories, costs, links] = await Promise.all([
    requireData(
      w.client.from("products").select("*").eq("business_unit_id", w.unit.id).order("name"),
    ),
    requireData(
      w.client
        .from("product_categories")
        .select("*")
        .eq("business_unit_id", w.unit.id)
        .order("name"),
    ),
    requireData(w.client.from("product_costs").select("*").eq("business_unit_id", w.unit.id)),
    w.event
      ? requireData(w.client.from("event_products").select("*").eq("event_id", w.event.id))
      : Promise.resolve([]),
  ]);
  const costMap = new Map(costs.map((row) => [row.product_id, row.unit_cost_vnd]));
  const eventProducts = new Set(links.filter((row) => row.active).map((row) => row.product_id));
  const filtered = products.filter(
    (row) =>
      (!query || `${row.name} ${row.sku}`.toLowerCase().includes(query.toLowerCase())) &&
      (!category || row.category_id === category) &&
      (!eventOnly || eventProducts.has(row.id)),
  );
  return (
    <>
      <PageTitle
        title={t("products.title")}
        description={t("products.description")}
        action={
          <Modal
            title={t("products.create")}
            trigger={
              <Button disabled={!categories.length}>
                <Plus aria-hidden />
                {t("products.create")}
              </Button>
            }
          >
            <ActionForm action="productSave" label={t("products.create")}>
              <ProductFields t={t} categories={categories} />
            </ActionForm>
          </Modal>
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-3">
        <Field label={t("common.search")}>
          <Input name="q" defaultValue={query} />
        </Field>
        <Field label={t("common.category")}>
          <Select name="category" defaultValue={category}>
            <option value="">{t("common.all")}</option>
            {categories.map((row) => (
              <option key={row.id} value={row.id}>
                {row.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="eventOnly"
            value="1"
            defaultChecked={eventOnly}
            className="size-5 accent-primary"
          />
          {t("common.event")}
        </label>
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          {t("common.filter")}
        </Button>
      </form>
      {!filtered.length ? (
        <EmptyState
          title={products.length ? t("common.noResults") : t("products.empty")}
          description={products.length ? t("common.clearSearch") : t("products.emptyBody")}
        />
      ) : (
        <Card className="overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("common.name")}</th>
                  <th>{t("products.sku")}</th>
                  <th>{t("common.category")}</th>
                  <th>{t("common.price")}</th>
                  <th>{t("common.unitCost")}</th>
                  <th>{t("common.status")}</th>
                  <th>{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <span className="font-semibold">{row.name}</span>
                      {row.sold_at ? (
                        <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <LockKeyhole className="size-3" aria-hidden />
                          {t("products.locked")}
                        </span>
                      ) : null}
                    </td>
                    <td className="font-mono text-xs text-muted-foreground">{row.sku}</td>
                    <td>{categories.find((c) => c.id === row.category_id)?.name}</td>
                    <td className="number font-medium">{formatVnd(row.price_vnd, w.locale)}</td>
                    <td className="number">
                      {costMap.get(row.id) == null
                        ? t("common.unset")
                        : formatVnd(costMap.get(row.id)!, w.locale)}
                    </td>
                    <td>
                      <Badge tone={row.active ? "green" : "neutral"}>
                        {t(row.active ? "common.active" : "common.inactive")}
                      </Badge>
                    </td>
                    <td>
                      <div className="flex gap-1">
                        <Modal
                          title={t("products.edit")}
                          trigger={<Button variant="ghost">{t("common.edit")}</Button>}
                        >
                          <ActionForm
                            action="productSave"
                            label={t("common.save")}
                            hidden={{ id: row.id }}
                          >
                            <ProductFields
                              row={row}
                              categories={categories}
                              cost={costMap.get(row.id)}
                              t={t}
                            />
                          </ActionForm>
                        </Modal>
                        <ActionForm
                          action="productSave"
                          variant="ghost"
                          label={t(row.active ? "common.inactive" : "common.active")}
                          confirm={row.active ? t("products.deactivateConfirm") : undefined}
                          hidden={{
                            id: row.id,
                            category_id: row.category_id,
                            sku: row.sku,
                            name: row.name,
                            price: String(row.price_vnd),
                            cost: costMap.get(row.id) == null ? "" : String(costMap.get(row.id)),
                            ...(!row.active ? { active: "on" } : {}),
                          }}
                          className="grid"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </>
  );
}
