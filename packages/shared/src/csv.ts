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
