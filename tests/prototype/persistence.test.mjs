import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
for (const path of ["persistence.js", "customer-bill.js", "staff-slip.js"])
  runInNewContext(readFileSync("public/prototype/" + path, "utf8"), context);
const { KEY, load, save, read } = context.FrogPersistence;
const { renderBill } = context.FrogCustomerBill;
const { renderStaffSlip } = context.FrogStaffSlip;
const initial = () => ({
  products: [{ id: "WS", name: "Gấu bông", category: "workshop" }],
  events: [{ id: "frog", name: "Frog Workshop", date: "2026-11-06" }],
  orders: [{
    id: "FG-0001", eventId: "frog", eventName: "Frog Workshop",
    eventDate: "2026-11-06", customer: "Minh Anh", status: "paid",
    method: "cash", createdAt: "2026-11-06T08:00:00Z", ticketId: "FROG-001",
    items: [{ productId: "WS", name: "Gấu bông", category: "workshop",
      qty: 1, price: 100000, cost: 35000, note: "Màu tím" }],
  }],
  tickets: [{ id: "FROG-001", eventId: "frog", orderId: "FG-0001",
    status: "waiting", checkedInAt: "2026-11-06T08:10:00Z" }],
  expenses: [{ id: "EX-1", eventId: "frog", amount: 25000,
    date: "2026-11-06", category: "other", archived: false }],
  selectedEvent: "frog", role: "owner", theme: "light", locale: "vi",
});
function memory() {
  const data = new Map();
  return { data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("first visit saves the complete sample state for popup printing", () => {
  const storage = memory();
  const session = load(storage, initial);
  assert.equal(session.source, "new");
  assert.equal(save(storage, session.state), true);
  assert.deepEqual(read(storage), session.state);
  assert.equal(storage.data.size, 1);
  assert.equal(storage.data.has(KEY), true);
});

test("refresh restores orders, check-in, expenses and selected workshop", () => {
  const storage = memory();
  const state = initial();
  state.orders[0].status = "refunded";
  state.tickets[0].checkedInAt = "2026-11-06T08:15:00Z";
  state.expenses[0].amount = 30000;
  assert.equal(save(storage, state), true);
  const restored = load(storage, initial);
  assert.equal(restored.source, "stored");
  assert.deepEqual(restored.state, state);
  assert.equal(restored.state.tickets[0].checkedInAt, "2026-11-06T08:15:00Z");
});

test("legacy state with no optional expense journal still loads", () => {
  const state = initial();
  delete state.expenses;
  const storage = memory();
  save(storage, state);
  assert.equal(load(storage, initial).source, "stored");
});

test("invalid or corrupted browser data uses a fallback without modifying the old copy", () => {
  const storage = memory();
  for (const bad of ["{", '{"orders":[],"products":[]}', "null"]) {
    storage.data.set(KEY, bad);
    const result = load(storage, initial);
    assert.equal(result.source, "invalid");
    assert.equal(result.state.orders.length, 1);
    assert.equal(storage.data.get(KEY), bad);
    assert.equal(read(storage), null);
  }
});

test("disabled storage does not crash the prototype loader or exporter", () => {
  const denied = { getItem() { throw Error("blocked"); }, setItem() { throw Error("blocked"); } };
  assert.equal(load(denied, initial).source, "unavailable");
  assert.equal(read(denied), null);
  assert.equal(save(denied, initial()), false);
});

test("opening or reprinting both ticket types never changes persisted business records", () => {
  const storage = memory();
  const state = initial();
  save(storage, state);
  const before = storage.data.get(KEY);
  const customer = renderBill(read(storage), "FG-0001");
  const staff = renderStaffSlip(read(storage), "FG-0001");
  assert.match(customer, /FROG-001/);
  assert.match(customer, /100\.000/);
  assert.match(staff, /FROG-001/);
  assert.doesNotMatch(staff, /100\.000|35\.000|Giá vốn/);
  assert.equal(storage.data.get(KEY), before);
  assert.equal(read(storage).tickets[0].status, "waiting");
  assert.equal(read(storage).tickets[0].checkedInAt, state.tickets[0].checkedInAt);
  assert.equal(renderBill(read(storage), "FG-0001"), customer);
  assert.equal(renderStaffSlip(read(storage), "FG-0001"), staff);
});

test("historical order price, notes and status survive catalogue changes", () => {
  const s = initial();
  s.orders[0].status = "refunded";
  s.products[0].name = "Tên sản phẩm mới";
  s.products[0].price = 250000;
  s.products[0].category = "food";
  const storage = memory();
  save(storage, s);
  const customer = renderBill(read(storage), "FG-0001");
  const staff = renderStaffSlip(read(storage), "FG-0001");
  assert.match(customer, /Gấu bông/);
  assert.match(customer, /100\.000/);
  assert.match(customer, /Màu tím/);
  assert.match(customer, /ĐÃ HOÀN TIỀN/);
  assert.match(staff, /WORKSHOP/);
  assert.doesNotMatch(staff, /Tên sản phẩm mới|250\.000/);
});
