import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyDraft, readDraft } from "../../src/features/counter/draft.ts";
import type { Product } from "../../src/lib/supabase/types.ts";
const products = [{ id: "p", active: true, price_vnd: 25000 }] as Product[];
test("counter draft round-trips customer, customizations, payment and retry key", () => {
  const draft = {
    ...emptyDraft(),
    customerName: "Nhật",
    phone: "0123456789",
    payment: "paid",
    method: "bank_transfer",
    requestId: "12345678-1234-1234-1234-123456789abc",
    items: [{ id: "line", productId: "p", quantity: 2, options: { note: "Ít đá" } }],
  };
  assert.deepEqual(readDraft(JSON.stringify(draft), products, []), draft);
});
test("counter draft rejects corrupt storage and obsolete catalogue items", () => {
  assert.deepEqual(readDraft("{", products, []), emptyDraft());
  const draft = {
    ...emptyDraft(),
    requestId: "12345678-1234-1234-1234-123456789abc",
    items: [{ id: "line", productId: "p", quantity: 2, options: {} }],
  };
  assert.equal(readDraft(JSON.stringify(draft), [], []).items.length, 0);
  assert.equal(readDraft(JSON.stringify(draft), [], []).requestId, null);
  draft.items[0].quantity = 1.5;
  assert.equal(readDraft(JSON.stringify(draft), products, []).items.length, 0);
});
test("counter draft drops stale tickets and untrusted product prices", () => {
  const restored = readDraft(
    JSON.stringify({
      ...emptyDraft(),
      ticketMode: "existing",
      ticketId: "cancelled",
      items: [{ id: "line", productId: "p", quantity: 1, options: {}, price_vnd: 1 }],
    }),
    products,
    [],
  );
  assert.equal(restored.ticketId, "");
  assert.equal("price_vnd" in restored.items[0], false);
});
