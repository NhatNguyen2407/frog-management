import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/registrations.js", "utf8"), context);
const { registrations, summary, update, view } = context.FrogRegistrations;

function makeState() {
  return {
    orders: [
      { id: "FG-1", status: "paid", customer: "Minh Anh" },
      { id: "FG-2", status: "unpaid", customer: "An" },
      { id: "FG-3", status: "refunded", customer: "Hà" }
    ],
    tickets: [
      { id: "COZY-1", orderId: "FG-1", eventId: "cozy", customer: "Minh Anh", status: "waiting" },
      { id: "COZY-2", orderId: "FG-2", eventId: "cozy", customer: "An", status: "registered" },
      { id: "COZY-3", orderId: "FG-3", eventId: "cozy", customer: "Hà", status: "completed" },
      { id: "COZY-4", orderId: "FG-1", eventId: "cozy", status: "cancelled" },
      { id: "ART-1", orderId: "FG-1", eventId: "autumn", status: "waiting" }
    ]
  };
}

test("registration metrics count paid, unpaid and check-ins per workshop", () => {
  const state = makeState();
  assert.equal(registrations(state, "cozy").length, 4);
  assert.deepEqual(JSON.parse(JSON.stringify(summary(state, "cozy"))),
    { registered: 2, arrived: 0, pending: 1, unpaid: 1 });
  assert.equal(summary(state, "autumn").pending, 1);
});

test("paid ticket can check in once and check-in does not change production status", () => {
  const state = makeState();
  const at = "2026-11-02T08:15:00.000Z";
  assert.equal(update(state, "cozy", "COZY-1", "check-in", at).error, undefined);
  assert.equal(state.tickets[0].checkedInAt, at);
  assert.equal(state.tickets[0].status, "waiting");
  assert.equal(summary(state, "cozy").arrived, 1);
  assert.ok(update(state, "cozy", "COZY-1", "check-in", at).error);
});

test("check-in is blocked for unpaid, cancelled, refunded or wrong-event tickets", () => {
  const state = makeState();
  for (const id of ["COZY-2", "COZY-3", "COZY-4", "ART-1"]) {
    assert.ok(update(state, "cozy", id, "check-in").error);
  }
  assert.equal(summary(state, "cozy").arrived, 0);
});

test("undo corrects an accidental check-in without touching queue or stock", () => {
  const state = makeState();
  assert.ok(update(state, "cozy", "COZY-1", "undo").error);
  update(state, "cozy", "COZY-1", "check-in", "2026-11-02T08:15:00Z");
  assert.equal(update(state, "cozy", "COZY-1", "undo").error, undefined);
  assert.equal(state.tickets[0].checkedInAt, undefined);
  assert.equal(state.tickets[0].status, "waiting");
  assert.ok(update(state, "cozy", "COZY-1", "undo").error);
});

test("search supports order/customer/ticket and escapes untrusted text", () => {
  const state = makeState();
  assert.match(view(state, "cozy", "FG-1"), /COZY-1/);
  assert.match(view(state, "cozy", "Minh"), /COZY-1/);
  assert.match(view(state, "cozy", "COZY-2"), /COZY-2/);
  state.tickets[0].customer = "<script>x</script>";
  assert.match(view(state, "cozy"), /&lt;script&gt;/);
  assert.doesNotMatch(view(state, "cozy"), /<script>/);
});
