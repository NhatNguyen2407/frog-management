import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
for (const file of ["expenses.js", "orders.js", "reporting.js"])
  runInNewContext(readFileSync("public/prototype/" + file, "utf8"), context);
const { snapshot, csv, orderDay, controls } = context.FrogReporting;
const makeOrder = (id, eventId, status, createdAt, price = 100000, extra = {}) => ({
  id, eventId, status, createdAt, customer: "Minh Anh", method: "cash", ticketId: "T-1",
  items: [{ productId: "P-1", name: "Gấu bông", category: "workshop", qty: 1, price, cost: 40000 }],
  ...extra,
});
const makeState = () => ({
  events: [{ id: "a" }, { id: "b" }],
  orders: [
    makeOrder("FG-1", "a", "paid", "2026-11-01T17:30:00Z"),
    makeOrder("FG-2", "a", "refunded", "2026-10-01T10:00:00Z", 70000, {
      refundedAt: "2026-11-02T07:00:00Z",
    }),
    makeOrder("FG-3", "a", "unpaid", "2026-11-02T07:00:00Z", 20000),
    makeOrder("FG-4", "b", "paid", "2026-11-02T07:00:00Z", 900000),
    makeOrder("FG-5", "a", "paid", "2026-11-02T04:00:00Z", 50000, {
      paidAt: "2026-11-03T01:00:00Z",
    }),
  ],
  nextExpense: 4,
  expenses: [
    { id: "EX-1", eventId: "a", date: "2026-11-02", amount: 30000,
      category: "rent", description: "Mặt bằng", archived: false },
    { id: "EX-2", eventId: "a", date: "2026-11-02", amount: 8000,
      category: "supplies", description: "Đã hủy", archived: true },
    { id: "EX-3", eventId: "b", date: "2026-11-02", amount: 60000,
      category: "rent", description: "Other", archived: false },
  ],
});

test("report date filters respect Vietnam timezone and selected workshop", () => {
  const s = makeState();
  assert.equal(orderDay(s.orders[0]), "2026-11-02");
  assert.equal(orderDay(s.orders[4]), "2026-11-03");
  const report = snapshot(s, "a", "2026-11-02", "2026-11-02");
  assert.equal(report.orders.map(o => o.id).join(","), "FG-1,FG-2,FG-3");
  assert.equal(report.expenses.length, 1);
  assert.equal(report.totals.revenue, 100000);
  assert.equal(report.totals.cogs, 80000);
  assert.equal(report.totals.expenses, 30000);
  assert.equal(report.totals.profit, -10000);
});

test("all-time finance includes Paid and refunded COGS but no voided expenses", () => {
  const result = snapshot(makeState(), "a");
  assert.equal(result.totals.revenue, 150000);
  assert.equal(result.totals.cogs, 120000);
  assert.equal(result.totals.expenses, 30000);
  assert.equal(result.totals.profit, 0);
});

test("invalid dates, reversed ranges and missing workshop are rejected", () => {
  const s = makeState();
  for (const [from, to] of [["2026-02-30", ""], ["2026-11-03", "2026-11-02"]])
    assert.ok(snapshot(s, "a", from, to).error);
  assert.ok(snapshot(s, "missing").error);
});

test("CSV exports honor date selection and exclude unrelated workshops", () => {
  const data = snapshot(makeState(), "a", "2026-11-02", "2026-11-02");
  const orders = csv("orders", data);
  const revenue = csv("revenue", data);
  const expenses = csv("expenses", data);
  assert.match(orders, /FG-2/);
  assert.doesNotMatch(orders, /FG-4|FG-5/);
  assert.match(revenue, /FG-1/);
  assert.doesNotMatch(revenue, /FG-2|FG-3|FG-4|FG-5/);
  assert.match(expenses, /EX-1/);
  assert.doesNotMatch(expenses, /EX-2|EX-3/);
  assert.ok(revenue.startsWith("\uFEFFsep=,\r\n"));
});

test("CSV protects Excel formulas and quotes text containing commas and newlines", () => {
  const s = makeState();
  s.orders[0].customer = '=HYPERLINK("url","hello")';
  s.orders[0].items[0].name = "Doll, size M\nBlue";
  s.expenses[0].description = "+SUM(1,1)";
  const data = snapshot(s, "a");
  assert.match(csv("orders", data), /"'=HYPERLINK\(""url"",""hello""\)"/);
  assert.match(csv("orders", data), /"Doll, size M\nBlue x1"/);
  assert.match(csv("expenses", data), /"'\+SUM\(1,1\)"/);
});

test("report snapshots and CSV generation do not mutate transactional data", () => {
  const s = makeState();
  const before = JSON.stringify(s);
  const report = snapshot(s, "a", "2026-11-01", "2026-11-03");
  for (const type of ["orders", "revenue", "expenses"]) csv(type, report);
  assert.equal(JSON.stringify(s), before);
});

test("export rejects unknown types and controls render both date fields", () => {
  assert.throws(() => csv("invalid", snapshot(makeState(), "a")));
  const html = controls("2026-11-02", "2026-11-03", "vi");
  assert.match(html, /id="report-from"/);
  assert.match(html, /id="report-to"/);
  assert.match(html, /report-export:expenses/);
  assert.match(controls("", "", "en"), /Export CSV/);
});
