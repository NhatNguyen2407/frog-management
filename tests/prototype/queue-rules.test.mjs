import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/queue-rules.js", "utf8"), context);
const { advance, check } = context.FrogQueue;

const setup = (payment = "paid", status = "registered") => ({
  orders: [{ id: "FG-1", eventId: "cozy", status: payment }],
  tickets: [{ id: "COZY-001", eventId: "cozy", orderId: "FG-1", status }]
});

test("ticket follows the valid queue path and records history", () => {
  const state = setup();
  const at = "2026-11-02T08:00:00Z";
  for (const next of ["ticket_printed", "waiting", "in_progress", "completed"]) {
    assert.equal(advance(state, "cozy", "COZY-001", at).next, next);
  }
  assert.equal(state.tickets[0].statusHistory.length, 4);
  assert.equal(state.tickets[0].updatedAt, at);
  assert.ok(advance(state, "cozy", "COZY-001").error);
});

test("unpaid ticket can wait but cannot enter preparation", () => {
  const state = setup("unpaid", "waiting");
  assert.ok(advance(state, "cozy", "COZY-001").error);
  assert.equal(state.tickets[0].status, "waiting");
  state.orders[0].status = "paid";
  assert.equal(advance(state, "cozy", "COZY-001").next, "in_progress");
});

test("cancellation, refund and wrong workshop block all transitions", () => {
  const state = setup();
  assert.ok(check(state, "autumn", "COZY-001").error);
  state.tickets[0].status = "cancelled";
  assert.ok(advance(state, "cozy", "COZY-001").error);
  state.tickets[0].status = "registered";
  state.orders[0].status = "refunded";
  assert.ok(advance(state, "cozy", "COZY-001").error);
  state.orders[0].status = "cancelled";
  assert.ok(advance(state, "cozy", "COZY-001").error);
  assert.equal(state.tickets[0].status, "registered");
  assert.equal(state.tickets[0].statusHistory, undefined);
});
