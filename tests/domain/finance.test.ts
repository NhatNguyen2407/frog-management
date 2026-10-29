import { test } from "node:test";
import assert from "node:assert/strict";
import {
  revenue,
  profitability,
  lineRevenue,
  type SaleOrder,
} from "../../src/lib/domain/finance.ts";

const line = { quantity: 2, unitPriceVnd: 100000, unitCostVnd: 30000, category: "workshop" };

test("only Paid, non-deleted orders and non-voided lines contribute revenue", () => {
  const orders: SaleOrder[] = [
    { status: "paid", lines: [line, { ...line, voided: true }] },
    ...(["unpaid", "refunded", "cancelled"] as const).map((status) => ({ status, lines: [line] })),
    { status: "paid", deleted: true, lines: [line] },
  ];
  assert.equal(revenue(orders), 200000);
});

test("mixed orders retain category revenue and sale price snapshots", () => {
  const orders: SaleOrder[] = [
    {
      status: "paid",
      lines: [line, { ...line, quantity: 1, unitPriceVnd: 25000, category: "food_beverage" }],
    },
  ];
  assert.equal(revenue(orders), 225000);
  assert.equal(revenue(orders, "workshop"), 200000);
  assert.equal(revenue(orders, "food_beverage"), 25000);
});

test("profit subtracts paid item COGS and event operating costs once", () => {
  const result = profitability(
    [
      { status: "paid", lines: [line] },
      { status: "unpaid", lines: [line] },
    ],
    40000,
  );
  assert.equal(result.profitVnd, 100000);
  assert.equal(result.marginPercent, 50);
});

test("missing unit costs never produce a misleading profit", () => {
  const result = profitability(
    [{ status: "paid", lines: [{ ...line, unitCostVnd: null }] }],
    10000,
  );
  assert.equal(result.profitVnd, null);
  assert.equal(result.marginPercent, null);
  assert.equal(result.missingUnitCostCount, 1);
});

test("zero revenue has undefined margin; loss can be negative", () => {
  assert.deepEqual(
    [profitability([], 40000).profitVnd, profitability([], 40000).marginPercent],
    [-40000, null],
  );
});

test("VND calculations reject fractional, negative and unsafe amounts", () => {
  assert.throws(() => lineRevenue({ ...line, unitPriceVnd: 0.5 }));
  assert.throws(() => lineRevenue({ ...line, unitPriceVnd: -1 }));
  assert.throws(() => lineRevenue({ ...line, quantity: 0 }));
  assert.throws(() => lineRevenue({ ...line, unitPriceVnd: Number.MAX_SAFE_INTEGER }));
});
