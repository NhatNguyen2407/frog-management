import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/expenses.js", "utf8"), context);
const { ensure, total, save, setArchived, dailySales, validate, view } = context.FrogExpenses;

const state = () => ({
  events: [{ id: "cozy", date: "2026-10-25", expense: 120000 },
    { id: "autumn", date: "2026-11-01", expense: 0 }]
});
const form = { date: "2026-11-02", amount: "30000", category: "supplies",
  description: "Workshop materials" };

test("one-time migration keeps old event expense without duplicating it", () => {
  const s = state();
  assert.equal(total(s, "cozy"), 120000);
  ensure(s);
  ensure(s);
  assert.equal(s.expenses.length, 1);
  assert.equal(s.expenses[0].legacy, true);
  assert.equal(total(s, "autumn"), 0);
});

test("create and edit expenses affect only the selected workshop", () => {
  const s = state();
  const entry = save(s, "cozy", form, null, "2026-11-02T00:00:00Z").expense;
  assert.equal(entry.id, "EX-00002");
  assert.equal(total(s, "cozy"), 150000);
  assert.equal(total(s, "autumn"), 0);
  assert.equal(save(s, "cozy", { ...form, amount: "10000" }, entry.id).error, undefined);
  assert.equal(total(s, "cozy"), 130000);
});

test("void/restoration retain history and cannot be applied twice", () => {
  const s = state();
  const entry = save(s, "cozy", form).expense;
  assert.equal(setArchived(s, "cozy", entry.id, true).error, undefined);
  assert.equal(total(s, "cozy"), 120000);
  assert.ok(setArchived(s, "cozy", entry.id, true).error);
  assert.ok(save(s, "cozy", form, entry.id).error);
  assert.equal(setArchived(s, "cozy", entry.id, false).error, undefined);
  assert.equal(total(s, "cozy"), 150000);
});

test("invalid amounts, dates, category and description are rejected", () => {
  const s = state();
  for (const bad of [
    { ...form, amount: "0" }, { ...form, amount: "1.5" },
    { ...form, date: "2026-02-30" }, { ...form, category: "nope" },
    { ...form, description: "x" }
  ]) assert.ok(validate(s, "cozy", bad).error);
  assert.equal(s.expenses, undefined);
});

test("daily sales use Paid orders by Vietnam calendar date, excluding refunds", () => {
  const orders = [
    { status: "paid", createdAt: "2026-11-01T18:00:00Z",
      items: [{ qty: 2, price: 50000 }] },
    { status: "paid", createdAt: "2026-11-02T04:00:00Z",
      items: [{ qty: 1, price: 20000 }] },
    { status: "refunded", createdAt: "2026-11-02T04:00:00Z",
      items: [{ qty: 1, price: 70000 }] },
    { status: "unpaid", createdAt: "2026-11-02T04:00:00Z",
      items: [{ qty: 1, price: 30000 }] }
  ];
  const result = dailySales(orders, new Date("2026-11-02T11:00:00Z"));
  assert.equal(result.days.length, 7);
  assert.equal(result.days.find(d => d.date === "2026-11-02").value, 120000);
  assert.equal(result.days.reduce((a, d) => a + d.value, 0), 120000);
});

test("chart falls back to last sale for historical demo orders", () => {
  const orders = [{ status: "paid", createdAt: "2026-10-15T08:00:00Z",
    items: [{ qty: 1, price: 100000 }] }];
  const result = dailySales(orders, new Date("2026-11-02T11:00:00Z"));
  assert.equal(result.historical, true);
  assert.equal(result.end, "2026-10-15");
  assert.equal(result.days[6].value, 100000);
});

test("user text is escaped in expense table", () => {
  const s = state();
  save(s, "cozy", { ...form, description: "<script>alert(1)</script>" });
  assert.match(view(s, "cozy"), /&lt;script&gt;/);
  assert.doesNotMatch(view(s, "cozy"), /<script>/);
});
