/**
 * Minimal CSV helpers for contact import/export.
 *
 * Delimiter is auto-detected because Excel in pt-BR (and most of Latin America)
 * writes `;` rather than `,` — assuming a comma silently turns every row into a
 * single unparsed column.
 */

export type CsvRow = Record<string, string>;

/** Detect the delimiter from the header line: whichever appears most. */
function detectDelimiter(line: string): string {
  const candidates = [";", ",", "\t"];
  let best = ",";
  let bestCount = -1;
  for (const d of candidates) {
    // Count only outside quotes.
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === d && !inQuotes) count++;
    }
    if (count > bestCount) {
      bestCount = count;
      best = d;
    }
  }
  return best;
}

/** Split one CSV line, honouring quoted fields and "" escapes. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out.map((f) => f.trim());
}

/**
 * Parse CSV text into objects keyed by the (lowercased) header row.
 * Handles CRLF, quoted fields containing newlines are NOT supported — keep it
 * simple and predictable rather than subtly wrong.
 */
export function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const clean = text.replace(/^﻿/, ""); // strip BOM (Excel writes one)
  const lines = clean.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = detectDelimiter(lines[0]);
  const headers = splitLine(lines[0], delimiter).map((h) => h.toLowerCase());

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = splitLine(lines[i], delimiter);
    const row: CsvRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? "";
    });
    rows.push(row);
  }
  return { headers, rows };
}

/** Pick the first present value among several possible header spellings. */
export function pick(row: CsvRow, ...keys: string[]): string | undefined {
  for (const k of keys) {
    const v = row[k.toLowerCase()];
    if (v && v.trim()) return v.trim();
  }
  return undefined;
}

/** Serialize rows to CSV text. Uses `;` — the delimiter Excel pt-BR expects. */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? "" : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
}

/** Trigger a client-side file download. */
export function downloadCsv(filename: string, csv: string): void {
  // Prefix a BOM so Excel opens accented characters correctly.
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
