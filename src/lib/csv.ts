/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const input = text.replace(/^﻿/, "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

/** Serialises rows; neutralises spreadsheet formula injection (=, +, -, @). */
export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return rows
    .map((row) =>
      row
        .map((value) => {
          if (value === null || value === undefined) return "";
          let cell = String(value);
          if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
          return /[",\n\r]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
        })
        .join(","),
    )
    .join("\r\n");
}

export const IMPORT_COLUMNS = ["type", "login_email", "login_password", "ptc_login", "ptc_password", "notes"] as const;

export const IMPORT_TEMPLATE = toCsv([
  [...IMPORT_COLUMNS],
  ["NEW", "demo.trainer001@example.com", "Demo-ChangeMe1", "demo_ptc_user01", "Demo-PtcPass1", "Level 30"],
  ["BOT", "demo.trainer002@example.com", "Demo-ChangeMe2", "", "", ""],
]);
