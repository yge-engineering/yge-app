// Per-month AP invoice volume.
//
// Plain English: bucket AP invoices by yyyy-mm of invoiceDate so
// the bookkeeper sees the monthly load coming in — count + $ in,
// broken down by status. The mirror of monthly-billing on the AR
// side.
//
// Per row: month (yyyy-mm), total, totalAmountCents, draft,
// pending, approved, paid, rejected, distinctVendors,
// monthOverMonthCountChange, monthOverMonthAmountChange.
//
// Sort by month asc.
//
// Different from vendor-invoice-cadence (per-vendor rhythm),
// ap-processing-time (per-invoice cycle time), monthly-billing
// (AR side), and ap-check-run (payment side).
//
// Pure derivation. No persisted records.

import type { ApInvoice, ApInvoiceStatus } from './ap-invoice';

export interface ApMonthlyVolumeRow {
  month: string;
  total: number;
  totalAmountCents: number;
  draft: number;
  pending: number;
  approved: number;
  paid: number;
  rejected: number;
  distinctVendors: number;
}

export interface ApMonthlyVolumeRollup {
  monthsConsidered: number;
  totalInvoices: number;
  totalAmountCents: number;
  monthOverMonthCountChange: number;
  monthOverMonthAmountChange: number;
}

export interface ApMonthlyVolumeInputs {
  apInvoices: ApInvoice[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildApMonthlyVolume(
  inputs: ApMonthlyVolumeInputs,
): {
  rollup: ApMonthlyVolumeRollup;
  rows: ApMonthlyVolumeRow[];
} {
  type Bucket = {
    month: string;
    counts: Record<ApInvoiceStatus, number>;
    amount: number;
    vendors: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    counts: { DRAFT: 0, PENDING: 0, APPROVED: 0, PAID: 0, REJECTED: 0 },
    amount: 0,
    vendors: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.counts[inv.status] += 1;
    b.amount += inv.totalCents;
    b.vendors.add(canonicalize(inv.vendorName));
    buckets.set(month, b);
  }

  const rows: ApMonthlyVolumeRow[] = Array.from(buckets.values())
    .map((b) => {
      let total = 0;
      for (const v of Object.values(b.counts)) total += v;
      return {
        month: b.month,
        total,
        totalAmountCents: b.amount,
        draft: b.counts.DRAFT,
        pending: b.counts.PENDING,
        approved: b.counts.APPROVED,
        paid: b.counts.PAID,
        rejected: b.counts.REJECTED,
        distinctVendors: b.vendors.size,
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
    .replace(/\b(llc|inc|incorporated|corp|corporation|co|company|ltd|limited)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
