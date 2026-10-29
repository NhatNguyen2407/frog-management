import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { formatVnd, formatDate } from "../../src/lib/formatting.ts";
test("VND grouping matches both requested locales", () => {
  assert.equal(formatVnd(1000000, "vi"), "1.000.000 ₫");
  assert.equal(formatVnd(1000000, "en"), "1,000,000 ₫");
});
test("event dates and timestamps use dd/MM/yyyy in Vietnam time", () => {
  assert.equal(formatDate("2026-10-25"), "25/10/2026");
  assert.equal(formatDate("2026-10-24T18:00:00Z"), "25/10/2026");
});
test("Vietnamese and English contain exactly the same translation keys", async () => {
  function keys(value: Record<string, unknown>, prefix = ""): string[] {
    return Object.entries(value).flatMap(([key, child]) =>
      typeof child === "object" && child !== null
        ? keys(child as Record<string, unknown>, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    );
  }
  const vi = JSON.parse(await readFile("messages/vi.json", "utf8"));
  const en = JSON.parse(await readFile("messages/en.json", "utf8"));
  assert.deepEqual(keys(vi).sort(), keys(en).sort());
});
