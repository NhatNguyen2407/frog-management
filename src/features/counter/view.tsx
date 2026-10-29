import { getTranslations } from "next-intl/server";
import { getWorkspace } from "@/lib/permissions/context";
import { requireData } from "@/lib/supabase/query";
import { EmptyState } from "@/components/shared";
import { Counter } from "./counter";
export async function CounterView() {
  const [w, t] = await Promise.all([getWorkspace(), getTranslations()]);
  if (!w.event)
    return <EmptyState title={t("common.noEvent")} description={t("common.noEventBody")} />;
  const [products, categories, links, tickets] = await Promise.all([
    requireData(
      w.client
        .from("products")
        .select("*")
        .eq("business_unit_id", w.unit.id)
        .eq("active", true)
        .order("name"),
    ),
    requireData(
      w.client
        .from("product_categories")
        .select("*")
        .eq("business_unit_id", w.unit.id)
        .order("name"),
    ),
    requireData(
      w.client.from("event_products").select("*").eq("event_id", w.event.id).eq("active", true),
    ),
    requireData(
      w.client
        .from("tickets")
        .select("*")
        .eq("event_id", w.event.id)
        .neq("status", "cancelled")
        .order("sequence_number", { ascending: false })
        .limit(500),
    ),
  ]);
  const ids = new Set(links.map((row) => row.product_id));
  return (
    <Counter
      products={products.filter((row) => ids.has(row.id))}
      categories={categories}
      tickets={tickets}
      event={w.event}
    />
  );
}
