import { getTranslations } from "next-intl/server";
import { getWorkspace } from "@/lib/permissions/context";
import { historyPattern } from "@/lib/domain/reporting";
import { formatDate, formatVnd } from "@/lib/formatting";
import { Link } from "@/i18n/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Notice, PageTitle, StatusBadge } from "@/components/shared";
import { Pagination } from "@/components/pagination";
import { CustomerSearch } from "./search";

export async function CustomersView({ query, page }: { query: string; page: number }) {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  let request = w.client
    .from("customer_history")
    .select("*", { count: "exact" })
    .eq("business_unit_id", w.unit.id)
    .order("created_at", { ascending: false })
    .order("id");
  if (query.trim()) request = request.ilike("search_text", historyPattern(query));
  const { data: rows, count, error } = await request.range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("app.load_failed");
  return (
    <>
      <PageTitle title={t("customers.title")} description={t("customers.description")} />
      <Notice variant="info">{t("customers.identityNotice")}</Notice>
      <CustomerSearch query={query} />
      {!rows?.length ? (
        <EmptyState title={t("common.noResults")} />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="break-words font-semibold">
                      {row.customer_name || t("customers.walkIn")}
                    </h2>
                    {row.phone_zalo ? (
                      <p className="mt-1 break-all text-sm text-muted-foreground">
                        {row.phone_zalo}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-muted-foreground">
                      {formatDate(row.created_at, true)}
                    </p>
                  </div>
                  <StatusBadge
                    status={row.payment_status}
                    label={t(`paymentStatus.${row.payment_status}`)}
                  />
                </div>
                <p className="mt-4 break-words text-sm">{row.event_name}</p>
                <p className="mt-1 font-mono text-xs">
                  {t("orders.number")} {row.id.slice(0, 8).toUpperCase()}
                </p>
                {row.ticket_id ? (
                  <Link
                    href={`/tickets/${row.ticket_id}/print`}
                    className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
                  >
                    {row.ticket_number}
                  </Link>
                ) : null}
                {row.checked_in_at ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {t("tickets.checkedIn")} · {formatDate(row.checked_in_at, true)}
                  </p>
                ) : null}
                <p className="mt-4 break-words text-sm">
                  {row.items.map((item) => `${item.name} ×${item.quantity}`).join(", ") ||
                    t("tickets.noItems")}
                </p>
                <p className="number mt-3 font-semibold">
                  {t("common.total")}:{" "}
                  {row.total_vnd === null
                    ? t("reports.unknown")
                    : formatVnd(row.total_vnd, w.locale)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={30}
        path="/customers"
        query={{ q: query }}
      />
    </>
  );
}
