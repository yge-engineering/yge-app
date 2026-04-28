// Per-month AR invoice volume.
//
// Plain English: bucket AR invoices by yyyy-mm of invoiceDate so
// the bookkeeper sees the monthly billing throughput — count + \$
// out, broken down by status. Mirror of ap-monthly-volume on the
// AR side.
//
// Per row: month (yyyy-mm), total, totalAmountCents, draft, sent,
// partiallyPaid, paid, disputed, writtenOff, distinctCustomers.
//
// Sort by month asc.
//
// Different from monthly-billing (count + \$ + per-source mix),
// customer-month-matrix (per customer × month), customer-dso
// (lifetime DSO), and ap-monthly-volume (AP side).
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceStatus } from './ar-invoice';

export interface ArMonthlyVolumeRow {
  month: string;
  total: number;
  totalAmountCents: number;
  draft: number;
  sent: number;
  partiallyPaid: number;
  paid: number;
  disputed: number;
  writtenOff: number;
  distinctCustomers: number;
}

export interface ArMonthlyVolumeRollup {
  monthsConsidered: number;
  totalInvoices: number;
  totalAmountCents: number;
  monthOverMonthCountChange: number;
  monthOverMonthAmountChange: number;
}

export interface ArMonthlyVolumeInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildArMonthlyVolume(
  inputs: ArMonthlyVolumeInputs,
): {
  rollup: ArMonthlyVolumeRollup;
  rows: ArMonthlyVolumeRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<ArInvoiceStatus, number>;
    amount: number;
    customers: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: {
      DRAFT: 0,
      SENT: 0,
      PARTIALLY_PAID: 0,
      PAID: 0,
      DISPUTED: 0,
      WRITTEN_OFF: 0,
    },
    amount: 0,
    customers: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[inv.status] += 1;
    b.amount += inv.totalCents;
    b.customers.add(canonicalize(inv.customerName));
    buckets.set(month, b);
  }

  const rows: ArMonthlyVolumeRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        totalAmountCents: b.amount,
        draft: b.counts.DRAFT,
        sent: b.counts.SENT,
        partiallyPaid: b.counts.PARTIALLY_PAID,
        paid: b.counts.PAID,
        disputed: b.counts.DISPUTED,
        writtenOff: b.counts.WRITTEN_OFF,
        distinctCustomers: b.customers.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let momCount = 0;
  let momAmount = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) {
      momCount = last.total - prev.total;
      momAmount = last.totalAmountCents - prev.totalAmountCents;
    }
  }

  let totalInvoices = 0;
  let totalAmount = 0;
  for (const r of rows) {
    totalInvoices += r.total;
    totalAmount += r.totalAmountCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalInvoices,
      totalAmountCents: totalAmount,
      monthOverMonthCountChange: momCount,
      monthOverMonthAmountChange: momAmount,
    },
    rows,
  };
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
