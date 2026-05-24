// CSV helpers for exporting bid items.
//
// Lives in the shared package so the web UI (download/copy buttons) and the
// API (a future server-side `/api/plans-to-estimate/drafts/:id/export.csv`
// endpoint) emit byte-for-byte identical output. RFC 4180: wrap any field
// containing comma, quote, CR, or LF in double quotes; double up internal
// quotes.

import type { PtoEBidItem } from './plans-to-estimate-output';
import { sumPtoEBidTotalCents } from './plans-to-estimate-output';
import type { PricedEstimate } from './priced-estimate';
import { computeEstimateTotals, lineExtendedCents } from './priced-estimate';
import { centsToDollars } from './money';

export const BID_ITEM_CSV_HEADERS = [
  'Item #',
  'Description',
  'Unit',
  'Quantity',
  'Confidence',
  'Page Reference',
  'Notes',
] as const;

/** Columns added when any item carries an estimatedUnitPriceCents — the
 *  Plans-to-Estimate@1.1.0 market-priced takeoff path. Kept as a separate
 *  constant so the schema-extension behavior is explicit + testable. */
export const BID_ITEM_PRICED_EXTRA_HEADERS = [
  'Unit Price',
  'Line Total',
  'Price Source',
  'Price Source Note',
] as const;

export function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Parse CSV text into rows of string cells (RFC 4180).
 *
 * The mirror image of `objectsToCsv` — used by every QuickBooks import
 * (chart of accounts, customers, vendors, open AR/AP, GL opening balances),
 * which all arrive as CSV exports. Handles:
 *
 *   - fields wrapped in double quotes
 *   - commas, CR, and LF inside quoted fields
 *   - escaped quotes ("" inside a quoted field)
 *   - CRLF or LF record separators (mixed is fine)
 *   - a leading UTF-8 BOM (QuickBooks + Excel both emit one)
 *
 * Output is literal: a blank line yields a one-cell row `['']`, and no
 * trimming happens inside cells. Callers that want to skip blank lines or
 * trim whitespace should do so on the returned rows.
 */
export function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let started = false;
  const n = text.length;
  let i = 0;
  // Strip a leading UTF-8 BOM if present.
  if (n > 0 && text.charCodeAt(0) === 0xfeff) i = 1;

  for (; i < n; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      started = true;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
      started = true;
    } else if (c === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      started = false;
    } else if (c === '\r') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      started = false;
      if (text[i + 1] === '\n') i++;
    } else {
      field += c;
      started = true;
    }
  }

  // Flush a trailing partial row (file that doesn't end in a newline).
  if (started || field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Parse CSV text into objects keyed by the header row. Blank lines are
 * skipped. Header cells are trimmed; duplicate headers keep the last
 * column. Rows shorter than the header get '' for the missing trailing
 * cells; longer rows drop the extras.
 */
export function parseCsvObjects(text: string): Array<Record<string, string>> {
  const rows = parseCsvRows(text).filter(
    (r) => !(r.length === 1 && r[0]!.trim() === ''),
  );
  if (rows.length === 0) return [];
  const header = rows[0]!.map((h) => h.trim());
  const out: Array<Record<string, string>> = [];
  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r]!;
    const obj: Record<string, string> = {};
    for (let c = 0; c < header.length; c++) {
      const key = header[c]!;
      if (key.length === 0) continue;
      obj[key] = cells[c] ?? '';
    }
    out.push(obj);
  }
  return out;
}

/** Generic typed-row CSV builder.
 *
 *  Columns are defined as `{ header, get }` pairs. The `get` function can
 *  return any of: string, number, undefined, or null — `csvEscape` handles
 *  the formatting per RFC 4180. Output ends with `\r\n` for Excel + Mac
 *  newlines on the same wire format.
 */
export function objectsToCsv<T>(
  rows: T[],
  columns: ReadonlyArray<{
    header: string;
    get: (row: T) => string | number | undefined | null;
  }>,
): string {
  const out: string[] = [columns.map((c) => csvEscape(c.header)).join(',')];
  for (const r of rows) {
    out.push(columns.map((c) => csvEscape(c.get(r))).join(','));
  }
  return out.join('\r\n') + '\r\n';
}

/** Format cents as a bare dollar string for CSV cells (no $ sign / commas). */
export function csvDollars(cents: number | null | undefined): string {
  if (cents == null) return '';
  return (cents / 100).toFixed(2);
}

/**
 * Bid-item CSV. When any item has an `estimatedUnitPriceCents`, four
 * extra columns + a totals block get appended so Ryan can paste the
 * priced AI draft straight into Excel and have the math line up:
 *
 *   Item #, Description, Unit, Quantity, Confidence, Page Reference, Notes,
 *   Unit Price, Line Total, Price Source, Price Source Note
 *
 * When NO items are priced (legacy drafts, T&M-only jobs), the output is
 * byte-for-byte identical to the original 7-column format — so saved CSVs
 * + downstream tooling keep working.
 */
export function bidItemsToCsv(items: PtoEBidItem[]): string {
  const anyPriced = items.some((i) => i.estimatedUnitPriceCents != null);
  const headers = anyPriced
    ? [...BID_ITEM_CSV_HEADERS, ...BID_ITEM_PRICED_EXTRA_HEADERS]
    : BID_ITEM_CSV_HEADERS;
  const rows: string[] = [headers.map(csvEscape).join(',')];

  for (const item of items) {
    const base = [
      item.itemNumber,
      item.description,
      item.unit,
      item.quantity,
      item.confidence,
      item.pageReference ?? '',
      item.notes ?? '',
    ];
    if (anyPriced) {
      // Recompute the line total defensively in case the model gave a unit
      // price but skipped the multiplication.
      const unit = item.estimatedUnitPriceCents;
      const line =
        item.estimatedLineTotalCents ??
        (unit != null ? Math.round(item.quantity * unit) : null);
      base.push(
        csvDollars(unit ?? null),
        csvDollars(line ?? null),
        item.priceSourceConfidence ?? '',
        item.priceSourceNote ?? '',
      );
    }
    rows.push(base.map(csvEscape).join(','));
  }

  if (anyPriced) {
    // Right-align the grand-total cell under the "Line Total" column
    // (index 8 in the priced layout, 0-based — so 8 leading blanks).
    const grand = sumPtoEBidTotalCents(items);
    rows.push('');
    rows.push(
      ['', '', '', '', '', '', '', 'Estimated bid total', csvDollars(grand)]
        .map(csvEscape)
        .join(','),
    );
  }

  // Excel handles \r\n cleanly. Trailing newline is conventional.
  return rows.join('\r\n') + '\r\n';
}

// ---- Priced estimate CSV -------------------------------------------------

export const PRICED_ESTIMATE_CSV_HEADERS = [
  'Item #',
  'Description',
  'Unit',
  'Quantity',
  'Unit Price',
  'Extended',
  'Confidence',
  'Page Reference',
  'Notes',
] as const;

/** Format cents as a plain decimal dollar string for CSV cells (no $ sign,
 *  no commas — keeps it Excel-friendly). Empty string for null. */
function dollarCellFromCents(cents: number | null | undefined): string {
  if (cents == null) return '';
  return centsToDollars(cents).toFixed(2);
}

/**
 * Emit the priced estimate as CSV. Includes a totals block at the bottom
 * (direct cost, O&P, bid total) so the recipient can sanity-check our math
 * without needing to drop in a SUM formula.
 */
export function pricedEstimateToCsv(estimate: PricedEstimate): string {
  const totals = computeEstimateTotals(estimate);
  const rows: string[] = [PRICED_ESTIMATE_CSV_HEADERS.map(csvEscape).join(',')];
  for (const item of estimate.bidItems) {
    rows.push(
      [
        item.itemNumber,
        item.description,
        item.unit,
        item.quantity,
        dollarCellFromCents(item.unitPriceCents),
        item.unitPriceCents == null ? '' : dollarCellFromCents(lineExtendedCents(item)),
        item.confidence,
        item.pageReference ?? '',
        item.notes ?? '',
      ]
        .map(csvEscape)
        .join(','),
    );
  }
  // Spacer + totals block, right-aligned under the Extended column.
  rows.push('');
  rows.push(['', '', '', '', 'Direct cost', dollarCellFromCents(totals.directCents)].map(csvEscape).join(','));
  rows.push(
    [
      '',
      '',
      '',
      '',
      `O&P (${(estimate.oppPercent * 100).toFixed(1)}%)`,
      dollarCellFromCents(totals.oppCents),
    ]
      .map(csvEscape)
      .join(','),
  );
  rows.push(
    ['', '', '', '', 'Bid total', dollarCellFromCents(totals.bidTotalCents)]
      .map(csvEscape)
      .join(','),
  );
  return rows.join('\r\n') + '\r\n';
}
