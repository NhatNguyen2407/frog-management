import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/orders.js", "utf8"), context);
const { apply, can, financialTotals } = context.FrogOrders;

function setup(status = "unpaid", ticketStatus = "waiting") {
  return {
    products: [
      { id: "WS-1", stock: 2 },
      { id: "FB-1", stock: 4 },
    ],
    orders: [
      {
        id: "FG-0001",
        eventId: "cozy",
        status,
        method: "cash",
        items: [
          { productId: "WS-1", qty: 2, price: 100000, cost: 35000, name: "Old name", note: "red" },
          { productId: "FB-1", qty: 1, price: 25000, cost: 9000, note: "" },
        ],
      },
    ],
    tickets: [{ id: "COZY-001", orderId: "FG-0001", eventId: "cozy", status: ticketStatus }],
  };
}
const at = "2026-10-26T12:00:00.000Z";

test("unpaid order becomes paid once, keeps snapshots and counts revenue", () => {
  const state = setup();
  assert.equal(apply(state, "FG-0001", "paid", { method: "bank", at }).error, undefined);
  assert.equal(state.orders[0].status, "paid");
  assert.equal(state.orders[0].method, "bank");
  assert.equal(state.orders[0].paidAt, at);
  assert.equal(state.orders[0].items[0].name, "Old name");
  assert.equal(state.orders[0].items[0].note, "red");
  assert.equal(state.products[0].stock, 2);
  assert.equal(financialTotals(state.orders, 0).revenue, 225000);
  assert.ok(apply(state, "FG-0001", "paid", { method: "cash" }).error);
  assert.ok(!can(state.orders[0], "cancel"));
});

test("cancelling unpaid restores stock and cancels ticket only once", () => {
  const state = setup();
  assert.equal(apply(state, "FG-0001", "cancel", { at }).error, undefined);
  assert.equal(state.orders[0].status, "cancelled");
  assert.equal(state.orders[0].cancelledAt, at);
  assert.equal(state.products[0].stock, 4);
  assert.equal(state.products[1].stock, 5);
  assert.equal(state.tickets[0].status, "cancelled");
  assert.equal(financialTotals(state.orders, 0).revenue, 0);
  assert.ok(apply(state, "FG-0001", "cancel").error);
  assert.equal(state.products[0].stock, 4);
});

test("ticket in progress or completed blocks unpaid cancellation", () => {
  for (const status of ["in_progress", "completed"]) {
    const state = setup("unpaid", status);
    assert.ok(apply(state, "FG-0001", "cancel").error);
    assert.equal(state.orders[0].status, "unpaid");
    assert.equal(state.products[0].stock, 2);
    assert.equal(state.tickets[0].status, status);
  }
});

test("refund removes revenue, keeps cost and stock, cancels unfinished ticket", () => {
  const state = setup("paid");
  assert.equal(apply(state, "FG-0001", "refund", { at }).error, undefined);
  assert.equal(state.orders[0].status, "refunded");
  assert.equal(state.products[0].stock, 2);
  assert.equal(state.tickets[0].status, "cancelled");
  assert.deepEqual(JSON.parse(JSON.stringify(financialTotals(state.orders, 120000))), {
    revenue: 0,
    cogs: 79000,
    expenses: 120000,
    profit: -199000,
    paid: 0,
  });
  assert.ok(apply(state, "FG-0001", "refund").error);
});

test("completed tickets remain completed after refund", () => {
  const state = setup("paid", "completed");
  apply(state, "FG-0001", "refund");
  assert.equal(state.tickets[0].status, "completed");
});

test("invalid payment method and incomplete stock reversal cannot mutate", () => {
  const state = setup();
  assert.ok(apply(state, "FG-0001", "paid", { method: "credit" }).error);
  assert.equal(state.orders[0].status, "unpaid");
  state.products.pop();
  assert.ok(apply(state, "FG-0001", "cancel").error);
  assert.equal(state.products[0].stock, 2);
  assert.equal(state.orders[0].status, "unpaid");
});
