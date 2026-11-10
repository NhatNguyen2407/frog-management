import { test } from "node:test";
import assert from "node:assert/strict";
import {
  csvChunks,
  csvLine,
  historyPattern,
  reportRange,
  type CsvRecord,
} from "../../src/lib/domain/reporting.ts";

test("report ranges include the complete Vietnam calendar day", () => {
  const range = reportRange("2026-11-02", "2026-11-02");
  assert.equal(new Date(range.start!).toISOString(), "2026-11-01T17:00:00.000Z");
  assert.equal(range.end, "2026-11-02T23:59:59.999999+07:00");
  assert.equal(new Date(range.end!).toISOString(), "2026-11-02T16:59:59.999Z");
  assert.equal(reportRange("2024-02-29", "").to, "");
  assert.deepEqual(reportRange(), { from: "", to: "", start: null, end: null });
});

test("invalid dates and reversed report ranges are rejected", () => {
  for (const day of [
    "2026-02-29",
    "2026-02-30",
    "0000-01-01",
    "not-a-date",
    "2026-01-01' or true",
  ]) {
    assert.throws(() => reportRange(day, ""), /invalid_date_range/);
    assert.throws(() => reportRange("", day), /invalid_date_range/);
  }
  assert.throws(() => reportRange("2026-11-03", "2026-11-02"), /invalid_date_range/);
});

test("history search supports Vietnamese without accents and escapes LIKE metacharacters", () => {
  assert.equal(historyPattern("  ĐẶNG Minh  "), "%dang minh%");
  assert.equal(historyPattern("100%_\\"), "%100\\%\\_\\\\%");
});

test("CSV retains Unicode, quotes, multiline text and unknown costs", () => {
  assert.equal(
    csvLine(['Đặng, Minh\nDoll "M"', null, 0, -25000]),
    '"Đặng, Minh\nDoll ""M""","","0","-25000"\r\n',
  );
  assert.equal(csvLine(["0123456789"]), '"0123456789"\r\n');
});

test("CSV prevents formulas in user text while retaining negative numeric amounts", () => {
  for (const value of ["=SUM(1,2)", "+SUM(1,2)", "-1+1", "@SUM(1)", " \t=1+1", "\tuser", "\n=1"]) {
    assert.ok(csvLine([value]).startsWith("\"'"));
  }
  assert.equal(csvLine([-1]), '"-1"\r\n');
});

test("CSV reads every page beyond the API row limit without mutating rows", async () => {
  const rows: CsvRecord[] = Array.from({ length: 1501 }, (_, i) => ({
    id: String(i).padStart(4, "0"),
    values: [i, `Khách ${i}`],
  }));
  const before = JSON.stringify(rows);
  const cursors: (string | null)[] = [];
  const parts: string[] = [];
  for await (const part of csvChunks(["ID", "Customer"], async (cursor) => {
    cursors.push(cursor);
    return rows.filter((row) => cursor === null || row.id > cursor).slice(0, 1000);
  }))
    parts.push(part);
  const csv = parts.join("");
  assert.ok(csv.startsWith("\uFEFFsep=,\r\n"));
  assert.ok(csv.includes('"1500","Khách 1500"\r\n'));
  assert.equal(csv.split("\r\n").length, 1504);
  assert.deepEqual(cursors, [null, "0999", "1500"]);
  assert.equal(JSON.stringify(rows), before);
});

test("CSV keeps headers for empty reports and propagates data failures", async () => {
  const parts: string[] = [];
  for await (const part of csvChunks(["Date"], async () => [])) parts.push(part);
  assert.equal(parts.join(""), '\uFEFFsep=,\r\n"Date"\r\n');
  await assert.rejects(async () => {
    for await (const _ of csvChunks(["Date"], async () => {
      throw new Error("app.load_failed");
    }))
      void _;
  }, /load_failed/);
});

test("cancelling a CSV stream does not start more database reads", async () => {
  let reads = 0;
  const stream = csvChunks(["Date"], async () => {
    reads++;
    return [];
  });
  await stream.next();
  await stream.return(undefined);
  assert.equal(reads, 0);
});
