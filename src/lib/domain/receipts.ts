import type { Financials, OrderItem } from "../supabase/types.ts";
import { lineRevenue, subtotal } from "./finance.ts";

export type ReceiptItem = Pick<
  OrderItem,
  "id" | "sku_snapshot" | "name_snapshot" | "category_code_snapshot" | "quantity" | "options"
> & { unit_price_vnd: number | null; total_vnd: number | null };

export function receiptSnapshot(
  orderId: string,
  items: readonly OrderItem[],
  prices: readonly Pick<Financials, "order_item_id" | "unit_price_vnd">[] | null,
) {
  const priceMap = new Map(prices?.map((row) => [row.order_item_id, row.unit_price_vnd]));
  const lines: ReceiptItem[] = items
    .filter((item) => item.order_id === orderId && item.voided_at === null)
    .map((item) => {
      const price = priceMap.get(item.id) ?? null;
      return {
        id: item.id,
        sku_snapshot: item.sku_snapshot,
        name_snapshot: item.name_snapshot,
        category_code_snapshot: item.category_code_snapshot,
        quantity: item.quantity,
        options: item.options,
        unit_price_vnd: price,
        total_vnd:
          price === null
            ? null
            : lineRevenue({
                quantity: item.quantity,
                unitPriceVnd: price,
                unitCostVnd: null,
                category: "",
              }),
      };
    });
  const total =
    prices === null || lines.some((line) => line.unit_price_vnd === null)
      ? null
      : subtotal(
          lines.map((line) => ({
            quantity: line.quantity,
            unitPriceVnd: line.unit_price_vnd!,
            unitCostVnd: null,
            category: "",
          })),
        );
  return { items: lines, total_vnd: total };
}

export function fitsLabel(size: {
  scrollHeight: number;
  clientHeight: number;
  scrollWidth: number;
  clientWidth: number;
}) {
  return size.scrollHeight <= size.clientHeight + 1 && size.scrollWidth <= size.clientWidth + 1;
}
