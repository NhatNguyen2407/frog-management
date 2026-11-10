import { getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { getWorkspace } from "@/lib/permissions/context";
import { reportRange } from "@/lib/domain/reporting";
import { localePath } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState, Field, Notice, PageTitle } from "@/components/shared";

export async function ReportsView({ query }: { query: Record<string, string | undefined> }) {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.owner)
    return (
      <EmptyState title={t("common.permissionTitle")} description={t("common.permissionBody")} />
    );
  const eventId = query.event ?? w.event?.id ?? "";
  let range: ReturnType<typeof reportRange> | null = null;
  try {
    range = reportRange(query.from, query.to);
  } catch {
    /* The form shows the invalid range below. */
  }
  const validEvent = !eventId || w.events.some((event) => event.id === eventId);
  return (
    <>
      <PageTitle title={t("reports.title")} description={t("reports.description")} />
      <Card>
        <CardContent>
          <form className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Field label={t("reports.workshop")}>
              <Select name="event" defaultValue={eventId}>
                <option value="">{t("common.all")}</option>
                {w.events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t("reports.from")}>
              <Input name="from" type="date" defaultValue={query.from ?? ""} />
            </Field>
            <Field label={t("reports.to")}>
              <Input name="to" type="date" defaultValue={query.to ?? ""} />
            </Field>
            <Button type="submit" variant="secondary" className="self-end">
              {t("common.filter")}
            </Button>
          </form>
          <p className="my-5 text-sm leading-relaxed text-muted-foreground">
            {t("reports.dateBasis")}
          </p>
          {!range || !validEvent ? (
            <Notice variant="error">
              {t(!validEvent ? "errors.not_allowed" : "errors.invalid_date_range")}
            </Notice>
          ) : (
            <div className="flex flex-wrap gap-3">
              {(["orders", "revenue", "expenses"] as const).map((kind) => (
                <Button asChild variant="secondary" key={kind}>
                  <a
                    href={localePath(
                      w.locale,
                      `/reports/export?${new URLSearchParams({ type: kind, event: eventId, from: range.from, to: range.to })}`,
                    )}
                  >
                    <Download aria-hidden />
                    {t(`reports.${kind}`)}
                  </a>
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
