// CSV helpers for exporting bid items.
//
// Lives in the shared package so the web UI (download/copy buttons) and the
// API (a future server-side `/api/plans-to-estimate/drafts/:id/export.csv`
// endpoint) emit byte-for-byte identical output. RFC 4180: wrap any field
// containing comma, quote, CR, or LF in double quotes; double up internal
// quotes.

import type { PtoEBidItem } from './plans-to-estimate-output';

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
