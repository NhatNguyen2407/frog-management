"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Printer, ArrowLeft, Leaf } from "lucide-react";
import { mutate } from "@/features/actions";
import { formatDate } from "@/lib/formatting";
import type { Ticket, Event, OrderItem, TicketStatus } from "@/lib/supabase/types";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Notice, StatusBadge } from "@/components/shared";
export function Receipt({
  ticket,
  event,
  items,
  history,
}: {
  ticket: Ticket;
  event: Event;
  items: OrderItem[];
  history: { id: string; to_status: TicketStatus; created_at: string }[];
}) {
  const t = useTranslations();
  const [count, setCount] = useState(ticket.print_count);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function print() {
    setError(null);
    const data = new FormData();
    data.set("id", ticket.id);
    startTransition(async () => {
      const result = await mutate("ticketPrint", data);
      if (!result.ok) {
        setError(result.error ?? "print_failed");
        return;
      }
      setCount(result.printCount ?? count + 1);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      window.print();
    });
  }
  return (
    <main className="print-page mx-auto max-w-3xl p-4 sm:p-8">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/tickets">
            <ArrowLeft aria-hidden />
            {t("common.back")}
          </Link>
        </Button>
        <Button onClick={print} disabled={pending || ticket.status === "cancelled"}>
          <Printer aria-hidden />
          {t(pending ? "common.saving" : "common.print")}
        </Button>
      </div>
      {error ? (
        <div className="no-print">
          <Notice variant="error">
            {t.has(`errors.${error}`) ? t(`errors.${error}`) : t("errors.print_failed")}
          </Notice>
        </div>
      ) : null}
      <Card className="receipt mx-auto w-full max-w-[360px]">
        <CardContent className="p-6">
          <div className="border-b border-dashed pb-5 text-center">
            <Leaf aria-hidden className="mx-auto mb-3 size-7" />
            <p className="text-lg font-semibold">{t("common.appName")}</p>
            <p className="mt-2 text-xs">{event.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{formatDate(event.event_date)}</p>
            <h1 className="number mt-5 text-4xl font-bold tracking-tight">
              {ticket.ticket_number}
            </h1>
            <p className="mt-2 text-sm font-medium">{ticket.customer_name}</p>
            {ticket.phone_zalo ? <p className="mt-1 text-xs">{ticket.phone_zalo}</p> : null}
          </div>
          <div className="space-y-4 py-5">
            {!items.length ? (
              <p className="text-xs">{t("tickets.noItems")}</p>
            ) : (
              items.map((item) => (
                <div key={item.id}>
                  <div className="flex items-start justify-between gap-3 text-sm font-semibold">
                    <span>{item.name_snapshot}</span>
                    <span className="number">×{item.quantity}</span>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {item.sku_snapshot}
                  </p>
                  {item.options &&
                  typeof item.options === "object" &&
                  !Array.isArray(item.options) ? (
                    <dl className="mt-2 space-y-1 text-xs">
                      {Object.entries(item.options).map(([key, value]) => (
                        <div key={key} className="break-words">
                          <dt className="inline font-medium">
                            {t.has(`options.${key}`) ? t(`options.${key}`) : key}:{" "}
                          </dt>
                          <dd className="inline whitespace-pre-wrap break-all">
                            {typeof value === "string" ? value : JSON.stringify(value)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              ))
            )}
          </div>
          <div className="border-t border-dashed pt-4 text-center text-[10px] leading-relaxed">
            <p>{t("tickets.thankYou")}</p>
            <p className="mt-3">{t("tickets.reprints", { count: Math.max(0, count - 1) })}</p>
            <p>{formatDate(ticket.created_at, true)}</p>
          </div>
        </CardContent>
      </Card>
      <section className="no-print mx-auto mt-6 max-w-[360px]">
        <Notice variant="info">{t("tickets.printHelp")}</Notice>
        <h2 className="mb-4 text-sm font-semibold">{t("tickets.history")}</h2>
        <ol className="space-y-3">
          {history.map((row) => (
            <li key={row.id} className="flex items-center justify-between gap-2">
              <StatusBadge label={t(`ticketStatus.${row.to_status}`)} status={row.to_status} />
              <span className="text-xs text-muted-foreground">
                {formatDate(row.created_at, true)}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
