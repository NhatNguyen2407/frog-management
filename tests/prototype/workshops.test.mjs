import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/workshops.js", "utf8"), context);
const { registeredCount, validate, save, list, editor } = context.FrogWorkshops;

function data() {
  return {
    selectedEvent: "cozy",
    events: [{ id: "cozy", name: "Cozy Workshop", date: "2026-10-25",
      prefix: "COZY", capacity: 3, status: "active", expense: 120000 }],
    tickets: [{ eventId: "cozy", status: "waiting" }, { eventId: "cozy", status: "cancelled" }],
    orders: [{ eventId: "cozy", id: "FG-0001" }],
    nextTicket: { cozy: 8 }
  };
}
test("create workshop gets a unique ID and initializes ticket counter", () => {
  const s = data();
  const r = save(s, { name: " Autumn Art ", date: "2026-11-03",
    prefix: "ART2", capacity: "20", status: "planned" });
  assert.equal(r.error, undefined);
  assert.equal(r.event.id, "event-art2");
  assert.equal(r.event.name, "Autumn Art");
  assert.equal(s.nextTicket["event-art2"], 1);
});
test("validates dates, capacity, prefix and status", () => {
  const s = data();
  const x = { name: "Autumn Art", date: "2026-11-03",
    prefix: "ART2", capacity: "20", status: "planned" };
  assert.ok(validate(s, { ...x, date: "2026-02-30" }).error);
  assert.ok(validate(s, { ...x, capacity: "1.5" }).error);
  assert.ok(validate(s, { ...x, prefix: "COZY" }).error);
  assert.ok(validate(s, { ...x, status: "invalid" }).error);
  assert.ok(validate(s, { ...x, prefix: "CHANGED" }, "cozy").error);
});
test("cannot reduce capacity below non-cancelled tickets", () => {
  const s = data();
  assert.equal(registeredCount(s, "cozy"), 1);
  const x = { name: "Updated", date: "2026-10-25",
    prefix: "COZY", capacity: "1", status: "active" };
  assert.equal(validate(s, x, "cozy").error, undefined);
  s.tickets.push({ eventId: "cozy", status: "registered" });
  assert.ok(validate(s, x, "cozy").error);
});
test("editing preserves historical order name and date", () => {
  const s = data();
  const r = save(s, { name: "Cozy Again", date: "2026-11-25",
    prefix: "COZY", capacity: "4", status: "planned" }, "cozy");
  assert.equal(r.error, undefined);
  assert.equal(s.orders[0].eventName, "Cozy Workshop");
  assert.equal(s.orders[0].eventDate, "2026-10-25");
  assert.equal(s.events[0].name, "Cozy Again");
  assert.equal(s.nextTicket.cozy, 8);
});
test("renders safely and locks ticket prefix", () => {
  const s = data();
  s.events[0].name = "<script>alert(1)</script>";
  const markup = list(s, "vi", true);
  assert.doesNotMatch(markup, /<script>/);
  assert.match(markup, /&lt;script&gt;/);
  assert.match(editor(s.events[0], "vi"), /readonly/);
});
