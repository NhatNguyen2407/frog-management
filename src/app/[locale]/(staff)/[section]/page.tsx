import { notFound } from "next/navigation";
import { EventsView, ProductsView } from "@/features/catalogue/views";
import { CounterView } from "@/features/counter/view";
import { TicketsView } from "@/features/tickets/view";
import { QueueView } from "@/features/queue/view";
import { OrdersView } from "@/features/orders/view";
import { InventoryView } from "@/features/inventory/view";
import { CostsView } from "@/features/costs/view";
import { SettingsView } from "@/features/settings/view";
export default async function SectionPage({
  params,
  searchParams,
}: {
  params: Promise<{ section: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const [{ section }, query] = await Promise.all([params, searchParams]);
  if (section === "events") return <EventsView />;
  if (section === "products")
    return (
      <ProductsView
        query={query.q ?? ""}
        category={query.category ?? ""}
        eventOnly={query.eventOnly === "1"}
      />
    );
  if (section === "counter") return <CounterView />;
  if (section === "tickets")
    return (
      <TicketsView
        query={query.q ?? ""}
        status={query.status ?? ""}
        page={Math.max(1, Math.min(100000, Math.floor(Number(query.page)) || 1))}
      />
    );
  if (section === "queue") return <QueueView />;
  if (section === "orders")
    return (
      <OrdersView
        status={query.status ?? ""}
        page={Math.max(1, Math.min(100000, Math.floor(Number(query.page)) || 1))}
      />
    );
  if (section === "inventory") return <InventoryView />;
  if (section === "costs") return <CostsView />;
  if (section === "settings") return <SettingsView />;
  notFound();
}
