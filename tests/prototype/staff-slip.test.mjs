import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/staff-slip.js", "utf8"), context);
const { renderStaffSlip } = context.FrogStaffSlip;

const state = {
  events: [{ id: "cozy", name: "Cozy Workshop", date: "2026-10-29" }],
  products: [{ id: "WS-1", category: "workshop" }, { id: "FB-1", category: "food" }],
  orders: [{
    id: "FG-0027", eventId: "cozy", customer: "Trang", ticketId: "COZY-013",
    status: "paid", createdAt: "2026-10-29T01:00:00.000Z",
    items: [
      { productId: "WS-1", category: "workshop", name: "Tote Large", qty: 1, price: 100000, cost: 35000, note: "Đỏ" },
      { productId: "FB-1", category: "food", name: "Oreo", qty: 2, price: 25000, cost: 9000, note: "" }
    ]
  }]
};

test("staff slip shows order, ticket, quantities, workshop/F&B and notes", () => {
  const html = renderStaffSlip(state, "FG-0027");
  assert.match(html, /FG-0027/);
  assert.match(html, /COZY-013/);
  assert.match(html, /Tote Large/);
  assert.match(html, /Oreo/);
  assert.match(html, /Ghi chú: Đỏ/);
  assert.match(html, /WORKSHOP/);
  assert.match(html, /SẢN PHẨM KÈM/);
  assert.doesNotMatch(html, /100\.000|150\.000|35000|9000/);
});

test("staff slip escapes customer and customization data", () => {
  const copy = JSON.parse(JSON.stringify(state));
  copy.orders[0].customer = "<script>";
  copy.orders[0].items[0].note = "<svg>";
  const html = renderStaffSlip(copy, "FG-0027");
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;svg&gt;/);
  assert.doesNotMatch(html, /<svg>|<script>/);
});

test("staff slip supports food-only order and unknown order", () => {
  const copy = JSON.parse(JSON.stringify(state));
  copy.orders[0].ticketId = null;
  copy.orders[0].items = [copy.orders[0].items[1]];
  const html = renderStaffSlip(copy, "FG-0027");
  assert.match(html, /FG-0027/);
  assert.doesNotMatch(html, /<h2>WORKSHOP<\/h2>/);
  assert.equal(renderStaffSlip(copy, "FG-9999"), null);
});
