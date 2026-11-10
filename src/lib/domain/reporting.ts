export type CsvValue = string | number | null;
export type CsvRecord = { id: string; values: CsvValue[] };

export function reportRange(from = "", to = "") {
  from = from.trim();
  to = to.trim();
  for (const day of [from, to]) {
    if (!day) continue;
    const date = new Date(`${day}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
      day.startsWith("0000") ||
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== day
    )
      throw new Error("app.invalid_date_range");
  }
  if (from && to && from > to) throw new Error("app.invalid_date_range");
  return {
    from,
    to,
    start: from ? `${from}T00:00:00+07:00` : null,
    end: to ? `${to}T23:59:59.999999+07:00` : null,
  };
}

export function historyPattern(query: string) {
  return `%${query
    .trim()
    .slice(0, 100)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[\\%_]/g, "\\$&")}%`;
}

export function csvLine(values: CsvValue[]) {
  return (
    values
      .map((value) => {
        let text = value === null ? "" : String(value);
        if (typeof value === "string" && (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)))
          text = `'${text}`;
        return `"${text.replaceAll('"', '""')}"`;
      })
      .join(",") + "\r\n"
  );
}

export async function* csvChunks(
  headers: string[],
  load: (cursor: string | null) => Promise<CsvRecord[]>,
) {
  yield `\uFEFFsep=,\r\n${csvLine(headers)}`;
  let cursor: string | null = null;
  for (;;) {
    const rows = await load(cursor);
    if (!rows.length) return;
    yield rows.map((row) => csvLine(row.values)).join("");
    cursor = rows[rows.length - 1].id;
  }
}
