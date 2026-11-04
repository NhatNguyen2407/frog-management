import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/stock-movements.js", "utf8"), context);
const { apply, log, view } = context.FrogStock;

const fresh = () => ({ products: [{ id: "WS-1", name: "Tote Large", stock: 5 }] });

test("stock in/out and adjustment record quantity, reason and resulting stock", () => {
  const state = fresh();
  const at = "2026-11-02T08:00:00Z";
  assert.equal(apply(state, "WS-1", "in", "3", "New delivery", at).error, undefined);
  assert.equal(apply(state, "WS-1", "out", "2", "Workshop supplies", at).error, undefined);
  assert.equal(apply(state, "WS-1", "adjust", "4", "Physical stock count", at).error, undefined);
  assert.equal(state.products[0].stock, 4);
  assert.deepEqual(
    JSON.parse(JSON.stringify(state.stockMovements.map((m) => [m.delta, m.before, m.after]))),
    [
      [3, 5, 8],
      [-2, 8, 6],
      [-2, 6, 4],
    ],
  );
  assert.equal(state.stockMovements[0].reason, "New delivery");
  assert.match(view(state), /Physical stock count/);
});

test("invalid, zero, unsafe or excessive stock operations do not mutate", () => {
  const state = fresh();
  for (const [kind, qty, reason] of [
    ["out", "6", "Out of stock"],
    ["in", "0", "Empty delivery"],
    ["adjust", "5", "No difference"],
    ["in", "3.5", "Invalid quantity"],
    ["in", "9007199254740991", "Overflow"],
    ["in", "2", ""],
  ]) {
    assert.ok(apply(state, "WS-1", kind, qty, reason).error);
  }
  assert.equal(state.products[0].stock, 5);
  assert.equal(state.stockMovements, undefined);
});

test("sale and cancellation logs record only already-applied stock changes", () => {
  const state = fresh();
  state.products[0].stock = 3;
  assert.equal(
    log(state, "WS-1", -2, "sale", "FG-0001", "2026-11-02T08:00:00Z", "FG-0001").error,
    undefined,
  );
  state.products[0].stock = 5;
  assert.equal(
    log(state, "WS-1", 2, "cancel", "FG-0001", "2026-11-02T09:00:00Z", "FG-0001").error,
    undefined,
  );
  assert.equal(state.stockMovements.length, 2);
  assert.equal(state.stockMovements[0].before, 5);
  assert.equal(state.stockMovements[1].after, 5);
  assert.equal(state.stockMovements[0].orderId, "FG-0001");
});

test("journal safely initializes for existing localStorage states", () => {
  const state = fresh();
  state.products[0].stock = 4;
  log(state, "WS-1", -1, "sale", "FG-0007");
  assert.equal(state.nextStockMovement, 2);
  assert.equal(state.stockMovements[0].id, "ST-00001");
});
