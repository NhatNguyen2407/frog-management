import { getTranslations } from "next-intl/server";
import { Plus, Printer, Search } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { formatDate } from "@/lib/formatting";
import type { TicketStatus } from "@/lib/supabase/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ActionForm } from "@/components/action-form";
import { Pagination } from "@/components/pagination";
import { EmptyState, PageTitle, StatusBadge, Field } from "@/components/shared";
const statuses: TicketStatus[] = [
  "registered",
  "ticket_printed",
  "waiting",
  "in_progress",
  "completed",
  "cancelled",
];
const next: Partial<Record<TicketStatus, TicketStatus>> = {
  ticket_printed: "waiting",
  waiting: "in_progress",
  in_progress: "completed",
};
export async function TicketsView({
  query,
  status,
  page,
}: {
  query: string;
  status: string;
  page: number;
}) {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.event)
    return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")} />;
  let request = w.client
    .from("tickets")
    .select("*", { count: "exact" })
    .eq("event_id", w.event.id)
    .order("sequence_number", { ascending: false });
  if (statuses.includes(status as TicketStatus))
    request = request.eq("status", status as TicketStatus);
  const safeQuery = query
    .replace(/[%,()"'\\\r\n]/g, " ")
    .trim()
    .slice(0, 100);
  if (safeQuery)
    request = request.or(`customer_name.ilike.%${safeQuery}%,ticket_number.ilike.%${safeQuery}%`);
  const { data: rows, error, count } = await request.range((page - 1) * 30, page * 30 - 1);
  if (error) throw new Error("app.load_failed");
  return (
    <>
      <PageTitle
        title={t("tickets.title")}
        description={t("tickets.description")}
        action={
          <Button asChild>
            <Link href="/counter">
              <Plus aria-hidden />
              {t("counter.createTicket")}
            </Link>
          </Button>
        }
      />
      <form className="mb-5 flex flex-wrap items-end gap-3">
        <Field label={t("common.search")}>
          <Input name="q" defaultValue={query} />
        </Field>
        <Field label={t("common.status")}>
          <Select name="status" defaultValue={status}>
            <option value="">{t("common.all")}</option>
            {statuses.map((value) => (
              <option key={value} value={value}>
                {t(`ticketStatus.${value}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">
          <Search aria-hidden />
          {t("common.filter")}
        </Button>
      </form>
      {!rows?.length ? (
        <EmptyState
          title={query || status ? t("common.noResults") : t("tickets.empty")}
          description={t("tickets.emptyBody")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {rows.map((row) => (
            <Card key={row.id}>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <Link
                      href={`/tickets/${row.id}/print`}
                      className="number text-xl font-bold tracking-tight text-primary hover:underline"
                    >
                      {row.ticket_number}
                    </Link>
                    <p className="mt-2 text-sm font-medium">{row.customer_name}</p>
                    {row.phone_zalo ? (
                      <p className="mt-1 text-xs text-muted-foreground">{row.phone_zalo}</p>
                    ) : null}
                  </div>
                  <StatusBadge status={row.status} label={t(`ticketStatus.${row.status}`)} />
                </div>
                <p className="mt-4 text-xs text-muted-foreground">
                  {formatDate(row.created_at, true)}
                </p>
                <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
                  {row.status !== "cancelled" ? (
                    <Button asChild variant="secondary">
                      <Link href={`/tickets/${row.id}/print`}>
                        <Printer aria-hidden />
                        {t("common.print")}
                      </Link>
                    </Button>
                  ) : null}
                  {next[row.status] ? (
                    <ActionForm
                      action="ticketStatus"
                      label={t("tickets.advance", {
                        status: t(`ticketStatus.${next[row.status]}`),
                      })}
                      hidden={{ id: row.id, status: next[row.status]! }}
                      className="grid"
                    />
                  ) : null}
                  {!["cancelled", "completed"].includes(row.status) ? (
                    <ActionForm
                      action="ticketStatus"
                      label={t("tickets.cancel")}
                      variant="ghost"
                      hidden={{ id: row.id, status: "cancelled" }}
                      confirm={t("tickets.cancelConfirm")}
                      className="grid"
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <Pagination
        page={page}
        total={count ?? 0}
        pageSize={30}
        path="/tickets"
        query={{ q: query, status }}
      />
    </>
  );
}
