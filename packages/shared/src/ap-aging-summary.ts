// AP aging summary.
//
// Plain English: bucket open AP invoice unpaid balances by age
// from invoiceDate (or dueDate when set) — current, 1-30, 31-60,
// 61-90, 90+. The mirror of customer-ar-aging on the AP side. The
// "what do we owe and how late are we" view.
//
// "Open" = status NOT in (PAID, REJECTED) AND unpaidBalance > 0.
//
// Per row: bucket, count, totalUnpaidCents, distinctVendors,
// share.
//
// Sort: CURRENT → 1_30 → 31_60 → 61_90 → 90_PLUS.
//
// Different from customer-ar-aging (AR side), aging (per-invoice
// list), and ap-check-run (payment-run snapshot). This is the
// aging summary by bucket.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export type ApAgingBucket = 'CURRENT' | 'PAST_1_30' | 'PAST_31_60' | 'PAST_61_90' | 'PAST_90_PLUS';

export interface ApAgingSummaryRow {
  bucket: ApAgingBucket;
  label: string;
  count: number;
  totalUnpaidCents: number;
  distinctVendors: number;
  share: number;
}

export interface ApAgingSummaryRollup {
  invoicesConsidered: number;
  totalUnpaidCents: number;
}

export interface ApAgingSummaryInputs {
  apInvoices: ApInvoice[];
  /** Reference date as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
}

const ORDER: ApAgingBucket[] = ['CURRENT', 'PAST_1_30', 'PAST_31_60', 'PAST_61_90', 'PAST_90_PLUS'];
const LABELS: Record<ApAgingBucket, string> = {
  CURRENT: 'Current',
  PAST_1_30: '1 – 30 days',
  PAST_31_60: '31 – 60 days',
  PAST_61_90: '61 – 90 days',
  PAST_90_PLUS: '90+ days',
};

export function buildApAgingSummary(
  inputs: ApAgingSummaryInputs,
): {
  rollup: ApAgingSummaryRollup;
  rows: ApAgingSummaryRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  type Acc = {
    count: number;
    cents: number;
    vendors: Set<string>;
  };
  const accs = new Map<ApAgingBucket, Acc>();
  for (const b of ORDER) accs.set(b, { count: 0, cents: 0, vendors: new Set() });
  let totalUnpaid = 0;
  let invoicesConsidered = 0;

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'PAID' || inv.status === 'REJECTED') continue;
    const unpaid = Math.max(0, inv.totalCents - inv.paidCents);
    if (unpaid <= 0) continue;
    const refDate = inv.dueDate ?? inv.invoiceDate;
    const refMs = Date.parse(refDate + 'T00:00:00Z');
    const days = Math.floor((asOfMs - refMs) / 86_400_000);
    const bucket = bucketize(days);
    const acc = accs.get(bucket)!;
    acc.count += 1;
    acc.cents += unpaid;
    acc.vendors.add(canonicalize(inv.vendorName));
    totalUnpaid += unpaid;
    invoicesConsidered += 1;
  }

  const rows: ApAgingSummaryRow[] = [];
  for (const bucket of ORDER) {
    const acc = accs.get(bucket);
    if (!acc) continue;
    const share = totalUnpaid === 0
      ? 0
      : Math.round((acc.cents / totalUnpaid) * 10_000) / 10_000;
    rows.push({
      bucket,
      label: LABELS[bucket],
      count: acc.count,
      totalUnpaidCents: acc.cents,
      distinctVendors: acc.vendors.size,
      share,
    });
  }

  return {
    rollup: {
      invoicesConsidered,
      totalUnpaidCents: totalUnpaid,
    },
    rows,
  };
}

function bucketize(days: number): ApAgingBucket {
  if (days <= 0) return 'CURRENT';
  if (days <= 30) return 'PAST_1_30';
  if (days <= 60) return 'PAST_31_60';
  if (days <= 90) return 'PAST_61_90';
  return 'PAST_90_PLUS';
}

function canonicalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,'"`]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
