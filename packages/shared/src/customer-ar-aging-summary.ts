// AR aging summary (mirror of ap-aging-summary).
//
// Plain English: bucket open AR invoice unpaid balances by age
// from invoiceDate (or dueDate when set) — current, 1-30, 31-60,
// 61-90, 90+. The "what's owed to us, how late" view.
//
// "Open" = status NOT in (PAID, WRITTEN_OFF) AND unpaidBalance > 0.
//
// Per row: bucket, count, totalUnpaidCents, distinctCustomers,
// share.
//
// Sort: CURRENT → 1_30 → 31_60 → 61_90 → 90_PLUS.
//
// Different from customer-ar-aging (per customer aging),
// customer-prompt-pay-claim (PCC §7107 statutory penalty),
// aging (per-invoice list). This is the bucketed summary.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export type ArAgingBucket = 'CURRENT' | 'PAST_1_30' | 'PAST_31_60' | 'PAST_61_90' | 'PAST_90_PLUS';

export interface ArAgingSummaryRow {
  bucket: ArAgingBucket;
  label: string;
  count: number;
  totalUnpaidCents: number;
  distinctCustomers: number;
  share: number;
}

export interface ArAgingSummaryRollup {
  invoicesConsidered: number;
  totalUnpaidCents: number;
}

export interface ArAgingSummaryInputs {
  arInvoices: ArInvoice[];
  /** Reference date as yyyy-mm-dd. Defaults to today. */
  asOf?: string;
}

const ORDER: ArAgingBucket[] = ['CURRENT', 'PAST_1_30', 'PAST_31_60', 'PAST_61_90', 'PAST_90_PLUS'];
const LABELS: Record<ArAgingBucket, string> = {
  CURRENT: 'Current',
  PAST_1_30: '1 – 30 days',
  PAST_31_60: '31 – 60 days',
  PAST_61_90: '61 – 90 days',
  PAST_90_PLUS: '90+ days',
};

export function buildCustomerArAgingSummary(
  inputs: ArAgingSummaryInputs,
): {
  rollup: ArAgingSummaryRollup;
  rows: ArAgingSummaryRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const asOfMs = Date.parse(asOf + 'T00:00:00Z');

  type Acc = {
    count: number;
    cents: number;
    customers: Set<string>;
  };
  const accs = new Map<ArAgingBucket, Acc>();
  for (const b of ORDER) accs.set(b, { count: 0, cents: 0, customers: new Set() });
  let totalUnpaid = 0;
  let invoicesConsidered = 0;

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'PAID' || inv.status === 'WRITTEN_OFF') continue;
    const unpaid = Math.max(0, inv.totalCents - inv.paidCents);
    if (unpaid <= 0) continue;
    const refDate = inv.dueDate ?? inv.invoiceDate;
    const refMs = Date.parse(refDate + 'T00:00:00Z');
    const days = Math.floor((asOfMs - refMs) / 86_400_000);
    const bucket = bucketize(days);
    const acc = accs.get(bucket)!;
    acc.count += 1;
    acc.cents += unpaid;
    acc.customers.add(canonicalize(inv.customerName));
    totalUnpaid += unpaid;
    invoicesConsidered += 1;
  }

  const rows: ArAgingSummaryRow[] = [];
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
      distinctCustomers: acc.customers.size,
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

function bucketize(days: number): ArAgingBucket {
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
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited|department|dept|of)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
