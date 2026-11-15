import { test } from "node:test";
import assert from "node:assert/strict";
import { fitsLabel, receiptSnapshot } from "../../src/lib/domain/receipts.ts";
import type { OrderItem } from "../../src/lib/supabase/types.ts";

const item: OrderItem = {
  id: "item-1",
  business_unit_id: "unit",
  event_id: "event",
  order_id: "order",
  product_id: "product",
  sku_snapshot: "OLD-SKU",
  name_snapshot: "Original product",
  category_code_snapshot: "food_beverage",
  quantity: 2,
  options: { note: "Không đá" },
  voided_at: null,
  created_at: "2026-11-15",
  updated_at: "2026-11-15",
};

test("order labels use immutable item and selling-price snapshots without costs", () => {
  const before = JSON.stringify(item);
  const receipt = receiptSnapshot(
    "order",
    [item],
    [{ order_item_id: "item-1", unit_price_vnd: 25000 }],
  );
  assert.equal(receipt.total_vnd, 50000);
  assert.equal(receipt.items[0].total_vnd, 50000);
  assert.equal(receipt.items[0].name_snapshot, "Original product");
  assert.deepEqual(receipt.items[0].options, { note: "Không đá" });
  assert.ok(!("unit_cost_vnd" in receipt.items[0]));
  assert.ok(!("business_unit_id" in receipt.items[0]));
  assert.equal(JSON.stringify(item), before);
});

test("receipt excludes voided items and items belonging to another order", () => {
  const result = receiptSnapshot(
    "order",
    [
      item,
      { ...item, id: "void", voided_at: "2026-11-15" },
      { ...item, id: "other", order_id: "another" },
    ],
    [{ order_item_id: "item-1", unit_price_vnd: 25000 }],
  );
  assert.deepEqual(
    result.items.map((line) => line.id),
    ["item-1"],
  );
  assert.equal(result.total_vnd, 50000);
});

test("unavailable receipt pricing stays unknown", () => {
  const result = receiptSnapshot("order", [item], null);
  assert.equal(result.total_vnd, null);
  assert.equal(result.items[0].unit_price_vnd, null);
  assert.equal(result.items[0].total_vnd, null);
});

test("missing historical prices stay unknown and genuine zero prices remain zero", () => {
  assert.equal(receiptSnapshot("order", [item], []).total_vnd, null);
  assert.equal(
    receiptSnapshot("order", [item], [{ order_item_id: "item-1", unit_price_vnd: 0 }]).total_vnd,
    0,
  );
});

test("unsafe or invalid receipt money is rejected instead of rounded", () => {
  for (const price of [-1, 0.5, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() =>
      receiptSnapshot("order", [item], [{ order_item_id: "item-1", unit_price_vnd: price }]),
    );
  }
});

test("print fit guard rejects vertical and horizontal clipping", () => {
  const size = { scrollHeight: 490, clientHeight: 490, scrollWidth: 287, clientWidth: 287 };
  assert.equal(fitsLabel(size), true);
  assert.equal(fitsLabel({ ...size, scrollHeight: 492 }), false);
  assert.equal(fitsLabel({ ...size, scrollWidth: 289 }), false);
});
