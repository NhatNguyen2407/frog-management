"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowLeft, Printer } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/shared";
import { formatDate, formatVnd } from "@/lib/formatting";
import { fitsLabel, type ReceiptItem } from "@/lib/domain/receipts";
import type { Event, Order, Ticket } from "@/lib/supabase/types";

export function OrderReceipt({
  order,
  event,
  ticket,
  snapshot,
}: {
  order: Pick<Order, "id" | "created_at" | "payment_status" | "payment_method">;
  event: Pick<Event, "name" | "event_date">;
  ticket: Pick<Ticket, "ticket_number" | "customer_name" | "phone_zalo"> | null;
  snapshot: { items: ReceiptItem[]; total_vnd: number | null };
}) {
  const t = useTranslations();
  const locale = useLocale();
  const [mode, setMode] = useState<"both" | "customer" | "staff">("both");
  const [ready, setReady] = useState(false);
  const [overflow, setOverflow] = useState(false);
  const pages = useRef<HTMLDivElement>(null);
  function checkFit() {
    const sheets = Array.from(pages.current?.querySelectorAll<HTMLElement>(".order-label") ?? []);
    const fits = sheets.length > 0 && sheets.every(fitsLabel);
    setOverflow(!fits);
    setReady(true);
    return fits;
  }
  useEffect(() => {
    const frame = requestAnimationFrame(checkFit);
    let active = true;
    const observer = new ResizeObserver(() => {
      if (active) checkFit();
    });
    pages.current
      ?.querySelectorAll(".order-label-content")
      .forEach((node) => observer.observe(node));
    document.fonts.ready.then(() => {
      if (active) checkFit();
    });
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [mode]);
  const reference = order.id.slice(0, 8).toUpperCase();
  const options = (item: ReceiptItem) =>
    item.options && typeof item.options === "object" && !Array.isArray(item.options)
      ? Object.entries(item.options)
          .filter(([, value]) => value !== null && value !== "")
          .map(
            ([key, value]) =>
              `${t.has(`options.${key}`) ? t(`options.${key}`) : key}: ${typeof value === "string" ? value : JSON.stringify(value)}`,
          )
          .join(" · ")
      : "";
  const modes = ["both", "customer", "staff"] as const;
  return (
    <main className="order-print mx-auto max-w-3xl p-4 sm:p-8" data-overflow={overflow}>
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost">
          <Link href="/orders">
            <ArrowLeft aria-hidden />
            {t("common.back")}
          </Link>
        </Button>
        <Button
          disabled={!ready || overflow || !snapshot.items.length}
          onClick={() => {
            if (checkFit()) window.print();
          }}
        >
          <Printer aria-hidden />
          {t("receipts.print")}
        </Button>
      </div>
      <div className="no-print mb-4 flex flex-wrap gap-2" aria-label={t("receipts.title")}>
        {modes.map((value) => (
          <Button
            key={value}
            variant={mode === value ? "default" : "secondary"}
            aria-pressed={mode === value}
            onClick={() => {
              if (value !== mode) {
                setReady(false);
                setMode(value);
              }
            }}
          >
            {t(`receipts.${value}`)}
          </Button>
        ))}
      </div>
      <div className="no-print">
        <Notice variant="info">{t("receipts.help")}</Notice>
      </div>
      {overflow ? (
        <div className="order-print-warning">
          <Notice variant="error">{t("receipts.overflow")}</Notice>
        </div>
      ) : null}
      <div ref={pages} className="order-labels">
        {modes
          .filter((value) => value !== "both" && (mode === "both" || mode === value))
          .map((kind) => (
            <article key={kind} className="order-label" aria-label={t(`receipts.${kind}`)}>
              <div className="order-label-content">
                <header className="order-label-header">
                  <strong>THE FROG ART SPACE</strong>
                  <h1>{t(`receipts.${kind}`)}</h1>
                  <div className="order-label-code">{ticket?.ticket_number ?? reference}</div>
                  <p>
                    {t("orders.number")} {reference}
                  </p>
                </header>
                <dl className="order-label-meta">
                  <div>
                    <dt>{t("counter.customerName")}</dt>
                    <dd>{ticket?.customer_name || t("customers.walkIn")}</dd>
                  </div>
                  {kind === "customer" && ticket?.phone_zalo ? (
                    <div>
                      <dt>{t("counter.phone")}</dt>
                      <dd>{ticket.phone_zalo}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t("common.event")}</dt>
                    <dd>{event.name}</dd>
                  </div>
                  {ticket ? (
                    <div>
                      <dt>{t("common.date")}</dt>
                      <dd>{formatDate(event.event_date)}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>{t("common.createdAt")}</dt>
                    <dd>{formatDate(order.created_at, true)}</dd>
                  </div>
                </dl>
                <section className="order-label-items" aria-label={t("nav.products")}>
                  {snapshot.items.map((item) => (
                    <div key={item.id} className="order-label-item">
                      <div className="order-label-line">
                        <span>
                          <b>{item.quantity}×</b> {item.name_snapshot}
                        </span>
                        {kind === "customer" ? (
                          <b>
                            {item.total_vnd === null
                              ? t("reports.unknown")
                              : formatVnd(item.total_vnd, locale)}
                          </b>
                        ) : null}
                      </div>
                      {options(item) ? <p>{options(item)}</p> : null}
                    </div>
                  ))}
                  {!snapshot.items.length ? <p>{t("tickets.noItems")}</p> : null}
                </section>
                {kind === "customer" ? (
                  <>
                    <div className="order-label-total">
                      <b>{t("common.total")}</b>
                      <strong>
                        {snapshot.total_vnd === null
                          ? t("reports.unknown")
                          : formatVnd(snapshot.total_vnd, locale)}
                      </strong>
                    </div>
                    {order.payment_method ? (
                      <p className="order-label-payment">
                        {t("orders.paymentMethod")}: {t(`paymentMethod.${order.payment_method}`)}
                      </p>
                    ) : null}
                  </>
                ) : null}
                <p className="order-label-status">{t(`paymentStatus.${order.payment_status}`)}</p>
                <footer>{t(kind === "customer" ? "tickets.thankYou" : "receipts.internal")}</footer>
              </div>
            </article>
          ))}
      </div>
    </main>
  );
}
