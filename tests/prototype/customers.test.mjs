import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/customers.js", "utf8"), context);
const { find, summary, view } = context.FrogCustomers;

const makeState = () => ({
  events: [
    { id: "w1", name: "Cozy Workshop" },
    { id: "w2", name: "Autumn Weekend" },
  ],
  orders: [
    {
      id: "FG-1",
      eventId: "w1",
      customer: "Minh Anh",
      status: "paid",
      createdAt: "2026-11-01T07:00:00Z",
      items: [{ productId: "A", name: "Gấu bông", qty: 1, price: 100000 }],
    },
    {
      id: "FG-2",
      eventId: "w2",
      customer: "Minh Anh",
      status: "paid",
      createdAt: "2026-11-03T07:00:00Z",
      items: [],
    },
    {
      id: "FG-3",
      eventId: "w1",
      customer: "Hà Linh",
      status: "refunded",
      createdAt: "2026-11-02T07:00:00Z",
      items: [],
    },
    {
      id: "FG-4",
      eventId: "w1",
      customer: "",
      status: "unpaid",
      createdAt: "2026-11-04T07:00:00Z",
      items: [],
    },
  ],
  tickets: [
    { id: "COZY-1", eventId: "w1", orderId: "FG-1", checkedInAt: "2026-11-01T08:00:00Z" },
    { id: "ART-1", eventId: "w2", orderId: "FG-2", checkedInAt: "2026-11-03T08:00:00Z" },
    { id: "COZY-3", eventId: "w1", orderId: "FG-3" },
  ],
});

test("customer history searches names, order numbers and ticket codes across events", () => {
  const state = makeState();
  assert.equal(find(state, "minh anh").length, 2);
  assert.equal(find(state, "MINH").length, 2);
  assert.equal(find(state, "ha linh").length, 1);
  assert.equal(find(state, "fg-3")[0].order.id, "FG-3");
  assert.equal(find(state, "art-1")[0].order.id, "FG-2");
});

test("matching names remain separate orders, not a fabricated customer identity", () => {
  const records = find(makeState(), "Minh Anh");
  assert.equal(records.length, 2);
  assert.notEqual(records[0].order.id, records[1].order.id);
  assert.equal(records[0].event.id, "w2");
  assert.equal(records[1].event.id, "w1");
});

test("check-in stats count actual tickets and distinct workshops without guessing attendance", () => {
  const records = find(makeState(), "Minh Anh");
  const data = summary(records);
  assert.equal(data.orders, 2);
  assert.equal(data.workshops, 2);
  assert.equal(data.checkIns, 2);
  const other = summary(find(makeState(), "Hà Linh"));
  assert.equal(other.workshops, 0);
  assert.equal(other.checkIns, 0);
});

test("missing tickets and unknown events display safely", () => {
  const state = makeState();
  state.orders.push({
    id: "FG-5",
    eventId: "unknown",
    customer: "Guest",
    createdAt: "2026-11-05T07:00:00Z",
    items: [],
  });
  const html = view(state, "Guest");
  assert.match(html, /Workshop không xác định/);
  assert.match(html, /Không có vé/);
});

test("customer provided text is escaped in both the view and search input", () => {
  const state = makeState();
  state.orders[0].customer = "<img src=x onerror=alert(1)>";
  state.orders[0].items[0].name = "<script>bad()</script>";
  const html = view(state, "<img");
  assert.match(html, /&lt;img/);
  assert.match(html, /&lt;script&gt;/);
  assert.doesNotMatch(html, /<img src=x/);
  assert.doesNotMatch(html, /<script>/);
});

test("history stays read only and independent of the current event", () => {
  const state = makeState();
  state.selectedEvent = "w1";
  const before = JSON.stringify(state);
  const results = find(state);
  assert.equal(results.length, 4);
  view(state, "Minh");
  assert.equal(JSON.stringify(state), before);
});

test("English view and empty search results are clear", () => {
  const state = makeState();
  assert.match(view(state, "", "en"), /Customer history|Matching orders|Search customer/);
  assert.match(view(state, "NOT_FOUND", "en"), /No matching orders found/);
});

test("customer history exposes localized cell labels for mobile cards", () => {
  const state = makeState();
  const vi = view(state, "Minh Anh", "vi");
  const en = view(state, "Minh Anh", "en");
  assert.match(vi, /data-label="Khách hàng"/);
  assert.match(vi, /data-label="Workshop"/);
  assert.match(vi, /data-label="Vé \/ Check-in"/);
  assert.match(en, /data-label="Customer"/);
  assert.match(en, /data-label="Ticket \/ Check-in"/);
  assert.match(view(state, "NOT_FOUND"), /customer-empty/);
});
