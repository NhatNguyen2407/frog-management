import type { ProductStock } from "../../src/lib/supabase/types.ts";
import { stockAvailable } from "../../src/lib/domain/stock.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { desiredStockUsage, stockAdjustment, stockSummary } from "../../src/lib/domain/stock.ts";

test("Paid, Unpaid and Refunded orders consume physical stock", () => {
  for (const status of ["paid", "unpaid", "refunded"] as const)
    assert.equal(desiredStockUsage(3, 0.5, status), 1.5);
});

test("cancellation, deletion and voiding reverse usage", () => {
  assert.equal(desiredStockUsage(3, 1, "cancelled"), 0);
  assert.equal(desiredStockUsage(3, 1, "paid", true), 0);
  assert.equal(desiredStockUsage(3, 1, "unpaid", false, true), 0);
  assert.equal(stockAdjustment(3, 0), 3);
});

test("repeated synchronization is idempotent and edits apply only the difference", () => {
  assert.equal(stockAdjustment(2, 2), 0);
  assert.equal(stockAdjustment(2, 5), -3);
  assert.equal(stockAdjustment(5, 2), 3);
});

test("missing preparation is distinct from zero; stock boundaries are inclusive", () => {
  assert.deepEqual(stockSummary(null, [-2], 1), { remaining: null, status: "not_entered" });
  assert.equal(stockSummary(0, [], 1).status, "out");
  assert.equal(stockSummary(3, [-2], 1).status, "low");
  assert.equal(stockSummary(4, [-2], 1).status, "ok");
  assert.equal(stockSummary(1, [-2], 0).remaining, -1);
});

test("fractional supplies keep three decimal places", () => {
  assert.equal(desiredStockUsage(3, 0.1, "unpaid"), 0.3);
  assert.equal(stockAdjustment(0.3, 0.2), 0.1);
  assert.equal(stockSummary(1, [-0.1, -0.2], 0).remaining, 0.7);
});

const row: ProductStock = {
  product_id: "p",
  stock_remaining: 5,
  low_stock_threshold: 1,
  editable: true,
};
const cart = [
  { id: "a", product: { id: "p" }, quantity: 2 },
  { id: "b", product: { id: "p" }, quantity: 1 },
  { id: "c", product: { id: "other" }, quantity: 10 },
];
test("availability counts all customized lines of one product", () => {
  assert.equal(stockAvailable([row], cart, "p"), 2);
  assert.equal(stockAvailable([row], cart, "p", "a"), 4);
});
test("restored oversized baskets and negative legacy stock cannot add more", () => {
  assert.equal(stockAvailable([{ ...row, stock_remaining: 1 }], cart, "p"), 0);
  assert.equal(stockAvailable([{ ...row, stock_remaining: -3 }], [], "p"), 0);
});
test("unconfigured product stock remains distinct from zero", () => {
  assert.equal(stockAvailable([{ ...row, stock_remaining: null }], [], "p"), 999);
  assert.equal(stockAvailable([], [], "p"), 999);
  assert.equal(stockAvailable([{ ...row, stock_remaining: 0 }], [], "p"), 0);
});
