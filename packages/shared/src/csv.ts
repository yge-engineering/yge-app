// CSV helpers for exporting bid items.
//
// Lives in the shared package so the web UI (download/copy buttons) and the
// API (a future server-side `/api/plans-to-estimate/drafts/:id/export.csv`
// endpoint) emit byte-for-byte identical output. RFC 4180: wrap any field
// containing comma, quote, CR, or LF in double quotes; double up internal
// quotes.

import type { PtoEBidItem } from './plans-to-estimate-output';
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

export function csvEscape(value: string | number | undefined | null): string {
  if (value === undefined || value === null) return '';
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
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

export function bidItemsToCsv(items: PtoEBidItem[]): string {
  const rows: string[] = [BID_ITEM_CSV_HEADERS.map(csvEscape).join(',')];
  for (const item of items) {
    rows.push(
      [
        item.itemNumber,
        item.description,
        item.unit,
        item.quantity,
        item.confidence,
        item.pageReference ?? '',
        item.notes ?? '',
      ]
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
