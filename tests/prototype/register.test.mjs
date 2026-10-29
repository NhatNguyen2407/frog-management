import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
const context = {};
runInNewContext(readFileSync("public/prototype/register.js", "utf8"), context);
const { quantity, hasWorkshop, canAdd, validate } = context.FrogRegister;
const products = [
  { id: "WS-1", category: "workshop", stock: 3 },
  { id: "FB-1", category: "food", stock: 2 },
];
const event = { id: "event-1", capacity: 2 };
const tickets = [{ eventId: "event-1", status: "registered" }];
test("item quantities aggregate across different customizations", () => {
  const cart = [
    { id: "WS-1", key: "L1", qty: 2, note: "pink" },
    { id: "WS-1", key: "L2", qty: 1, note: "blue" },
  ];
  assert.equal(quantity(cart, "WS-1"), 3);
  assert.equal(canAdd(cart, products[0]), false);
  assert.equal(validate(cart, products, event, tickets, true), null);
  cart[1].qty = 2;
  assert.match(validate(cart, products, event, tickets, true), /Không đủ hàng/);
});
test("archived products, food-only tickets and ticket capacity are checked", () => {
  const food = [{ id: "FB-1", qty: 1, key: "L1" }],
    workshop = [{ id: "WS-1", qty: 1, key: "L2" }];
  assert.equal(hasWorkshop(food, products), false);
  assert.equal(hasWorkshop(workshop, products), true);
  assert.ok(validate(food, products, event, tickets, true));
  assert.equal(validate(food, products, event, tickets, false), null);
  assert.ok(validate(workshop, products, event, [...tickets, ...tickets], true));
  assert.equal(validate(workshop, products, event, tickets, true), null);
  assert.equal(canAdd(workshop, { ...products[0], active: false }), false);
  assert.ok(validate(workshop, [{ ...products[0], active: false }], event, tickets, true));
});
test("cannot sell zero-stock or invalid cart quantities", () => {
  assert.equal(canAdd([], { ...products[0], stock: 0 }), false);
  assert.ok(validate([{ id: "WS-1", qty: 0 }], products, event, [], true));
  assert.ok(validate([{ id: "FB-1", qty: 3 }], products, event, [], false));
});
