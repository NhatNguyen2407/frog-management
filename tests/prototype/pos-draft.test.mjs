import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/pos-draft.js", "utf8"), context);
const { PREFIX, empty, normalize, load, save, clear, clearAll } = context.FrogPosDraft;
const products = [{ id: "WS-1", name: "Tote", stock: 5 }, { id: "FB-1", name: "Cookie", stock: 8 }];
const draft = () => ({
  cart: [{ id: "WS-1", key: "L9", qty: 2, note: "Blue plushie" },
    { id: "FB-1", key: "L10", qty: 1, note: "No sugar" }],
  customer: "Minh Anh",
  method: "bank",
  payment: "unpaid",
  createTicket: false,
});
function storage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(i) { return [...data.keys()][i] ?? null; },
    getItem(k) { return data.get(k) ?? null; },
    setItem(k, v) { data.set(k, v); },
    removeItem(k) { data.delete(k); },
    data,
  };
}

test("restores a half-finished POS order with all inputs after refresh", () => {
  const browser = storage();
  assert.equal(save(browser, "cozy", draft(), products), true);
  const result = load(browser, "cozy", products);
  assert.equal(result.cart.length, 2);
  assert.equal(result.cart[0].qty, 2);
  assert.equal(result.cart[0].note, "Blue plushie");
  assert.equal(result.customer, "Minh Anh");
  assert.equal(result.method, "bank");
  assert.equal(result.payment, "unpaid");
  assert.equal(result.createTicket, false);
  assert.equal(result.cart[1].key, "L2");
});

test("drafts are isolated by workshop and can be restored in either order", () => {
  const browser = storage();
  save(browser, "cozy", draft(), products);
  save(browser, "autumn", { ...draft(), customer: "Autumn guest" }, products);
  assert.equal(load(browser, "cozy", products).customer, "Minh Anh");
  assert.equal(load(browser, "autumn", products).customer, "Autumn guest");
  clear(browser, "autumn");
  assert.equal(load(browser, "cozy", products).cart.length, 2);
  assert.equal(load(browser, "autumn", products).cart.length, 0);
});

test("drafts never write to transactional state or reserve inventory", () => {
  const browser = storage();
  const state = { orders: [], tickets: [], products: structuredClone(products) };
  const before = JSON.stringify(state);
  save(browser, "cozy", draft(), state.products);
  load(browser, "cozy", state.products);
  assert.equal(JSON.stringify(state), before);
  assert.equal(state.orders.length, 0);
  assert.equal(state.products[0].stock, 5);
});

test("restoration skips removed products and invalid lines instead of crashing", () => {
  const browser = storage();
  const value = { ...draft(), cart: [
    { id: "WS-1", qty: 1, note: "Valid" },
    { id: "OLD", qty: 1, note: "Removed" },
    { id: "FB-1", qty: -3 },
    { id: "FB-1", qty: "2" },
  ] };
  browser.setItem(PREFIX + "cozy", JSON.stringify(value));
  const restored = load(browser, "cozy", products);
  assert.equal(restored.cart.length, 1);
  assert.equal(restored.skipped, 3);
  assert.equal(restored.cart[0].note, "Valid");
});

test("bad JSON and blocked browser storage degrade to an empty draft", () => {
  const browser = storage();
  browser.setItem(PREFIX + "cozy", "{broken");
  assert.equal(load(browser, "cozy", products).cart.length, 0);
  const denied = { getItem() { throw Error("denied"); }, setItem() { throw Error("denied"); },
    removeItem() { throw Error("denied"); } };
  assert.equal(load(denied, "cozy", products).cart.length, 0);
  assert.equal(save(denied, "cozy", draft(), products), false);
  assert.equal(clear(denied, "cozy"), false);
});

test("saving an empty draft removes only the relevant workshop entry", () => {
  const browser = storage();
  save(browser, "cozy", draft(), products);
  save(browser, "autumn", draft(), products);
  assert.equal(save(browser, "cozy", empty(), products), true);
  assert.equal(load(browser, "cozy", products).cart.length, 0);
  assert.equal(load(browser, "autumn", products).cart.length, 2);
});

test("explicit demo reset clears every draft but leaves unrelated storage untouched", () => {
  const browser = storage();
  save(browser, "cozy", draft(), products);
  save(browser, "autumn", draft(), products);
  browser.setItem("user-preference", "keep");
  assert.equal(clearAll(browser), true);
  assert.equal(browser.getItem("user-preference"), "keep");
  assert.equal(browser.length, 1);
});

test("input values are length-limited and invalid payment options fall back safely", () => {
  const data = normalize({ ...draft(), customer: "X".repeat(100),
    payment: "refunded", method: "card", cart: [
      { id: "WS-1", qty: 2, note: "N".repeat(180) },
    ] }, products);
  assert.equal(data.customer.length, 80);
  assert.equal(data.cart[0].note.length, 160);
  assert.equal(data.payment, "paid");
  assert.equal(data.method, "cash");
});

test("app wires autosave to POS edits and clears only after successful checkout", () => {
  const app = readFileSync("public/prototype/app.js", "utf8");
  const html = readFileSync("public/prototype/index.html", "utf8");
  assert.match(app, /function restoreDraft\(\)/);
  assert.match(app, /function saveDraft\(\)/);
  assert.match(app, /FrogPosDraft\.clear\(draftStorage\(\), state\.selectedEvent\)/);
  assert.match(app, /FrogPosDraft\.clearAll\(draftStorage\(\)\)/);
  assert.match(app, /if \(!persist\(\)\) \{/);
  assert.ok(app.indexOf("if (!persist())") < app.indexOf("FrogPosDraft.clear(draftStorage()"));
  assert.match(app, /if \(e\.target\.id === "customer-name"\) \{/);
  assert.match(app, /if \(e\.target\.dataset\.lineNote\)/);
  assert.ok(html.indexOf("pos-draft.js") < html.indexOf("app.js"));
});
