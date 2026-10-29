import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/event-switcher.js", "utf8"), context);
const { render } = context.FrogEventSwitcher;
const events = [
  { id: "cozy", name: "Cozy Workshop", date: "2026-10-25", status: "active" },
  { id: "autumn", name: "Autumn Art Weekend", date: "2026-11-01", status: "planned" }
];

test("selects the saved event and provides accessible menu semantics", () => {
  const html = render(events, "cozy", "vi");
  assert.match(html, /aria-haspopup="menu"/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /role="menuitemradio"/);
  assert.match(html, /aria-checked="true" data-event-option="cozy"/);
  assert.match(html, /01\/11\/2026/);
  assert.match(html, /Dự kiến/);
});

test("renders English labels while preserving event IDs", () => {
  const html = render(events, "autumn", "en");
  assert.match(html, /Choose event/);
  assert.match(html, /data-event-option="autumn"/);
  assert.match(html, /Planned/);
});

test("escapes untrusted event names and identifiers", () => {
  const html = render([{ id: "x\" onclick=\"bad", name: "<script>test</script>", date: "", status: "active" }], "x\" onclick=\"bad");
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&quot;/);
});
