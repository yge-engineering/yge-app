// Per-vendor recurring-invoice cadence predictor.
//
// Plain English: a fuel vendor bills weekly, a yard lease bills
// monthly, an insurance carrier bills annually. When the rhythm
// breaks (the monthly fuel bill is two weeks late), it's worth
// catching before the supply chain notices.
//
// Per vendor with 3+ invoices, computes:
//   - mean + median interval between consecutive invoices
//   - expected next invoice date (last invoice + median interval)
//   - days overdue if asOf is past the expected date
//   - cadence flag: STEADY, IRREGULAR (high spread), OVERDUE
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export type CadenceFlag = 'STEADY' | 'IRREGULAR' | 'OVERDUE' | 'INSUFFICIENT_DATA';

export interface VendorCadenceRow {
  vendorName: string;
  invoiceCount: number;
  firstInvoiceDate: string;
  lastInvoiceDate: string;
  meanIntervalDays: number | null;
  medianIntervalDays: number | null;
  /** Standard deviation of intervals — surfaces irregular patterns. */
  intervalStdDev: number | null;
  expectedNextDate: string | null;
  daysOverdue: number | null;
  flag: CadenceFlag;
}

export interface VendorCadenceRollup {
  vendorsConsidered: number;
  steady: number;
  irregular: number;
  overdue: number;
  insufficient: number;
}

export interface VendorCadenceInputs {
  asOf?: string;
  apInvoices: ApInvoice[];
  /** Min invoices to score a vendor. Default 3. */
  minInvoices?: number;
  /** Tolerance days past expected before flagging OVERDUE.
   *  Default = 1.5 * medianInterval (capped at 30 days). */
  overdueTolerance?: number;
}

export function buildVendorInvoiceCadence(
  inputs: VendorCadenceInputs,
): {
  rollup: VendorCadenceRollup;
  rows: VendorCadenceRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);
  const minInvoices = inputs.minInvoices ?? 3;

  type Bucket = {
    vendorName: string;
    dates: string[];
  };
  const buckets = new Map<string, Bucket>();
  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const key = inv.vendorName.trim().toLowerCase();
    const b = buckets.get(key) ?? { vendorName: inv.vendorName.trim(), dates: [] };
    b.dates.push(inv.invoiceDate);
    buckets.set(key, b);
  }

  const rows: VendorCadenceRow[] = [];
  const counts = { steady: 0, irregular: 0, overdue: 0, insufficient: 0 };

  for (const b of buckets.values()) {
    const sorted = [...b.dates].sort();
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    if (sorted.length < minInvoices) {
      rows.push({
        vendorName: b.vendorName,
        invoiceCount: sorted.length,
        firstInvoiceDate: first,
        lastInvoiceDate: last,
        meanIntervalDays: null,
        medianIntervalDays: null,
        intervalStdDev: null,
        expectedNextDate: null,
        daysOverdue: null,
        flag: 'INSUFFICIENT_DATA',
      });
      counts.insufficient += 1;
      continue;
    }

    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i += 1) {
      const a = parseDate(sorted[i - 1]!);
      const b2 = parseDate(sorted[i]!);
      if (!a || !b2) continue;
      intervals.push(daysBetween(a, b2));
    }
    if (intervals.length === 0) {
      rows.push({
        vendorName: b.vendorName,
        invoiceCount: sorted.length,
        firstInvoiceDate: first,
        lastInvoiceDate: last,
        meanIntervalDays: null,
        medianIntervalDays: null,
        intervalStdDev: null,
        expectedNextDate: null,
        daysOverdue: null,
        flag: 'INSUFFICIENT_DATA',
      });
      counts.insufficient += 1;
      continue;
    }

    const mean =
      intervals.reduce((acc, x) => acc + x, 0) / intervals.length;
    const median = computeMedian([...intervals].sort((a, b) => a - b));
    const variance =
      intervals.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) /
      intervals.length;
    const stdDev = Math.sqrt(variance);

    const lastDate = parseDate(last)!;
    const expectedDate = new Date(
      lastDate.getTime() + Math.round(median) * 24 * 60 * 60 * 1000,
    );
    const daysPast = daysBetween(expectedDate, refNow);
    const tolerance =
      inputs.overdueTolerance ?? Math.min(30, Math.round(median * 0.5));

    let flag: CadenceFlag;
    if (daysPast > tolerance) {
      flag = 'OVERDUE';
      counts.overdue += 1;
    } else if (stdDev > median * 0.5) {
      flag = 'IRREGULAR';
      counts.irregular += 1;
    } else {
      flag = 'STEADY';
      counts.steady += 1;
    }

    rows.push({
      vendorName: b.vendorName,
      invoiceCount: sorted.length,
      firstInvoiceDate: first,
      lastInvoiceDate: last,
      meanIntervalDays: round1(mean),
      medianIntervalDays: round1(median),
      intervalStdDev: round1(stdDev),
      expectedNextDate: isoDate(expectedDate),
      daysOverdue: daysPast > 0 ? daysPast : 0,
      flag,
    });
  }

  // OVERDUE first (most actionable), IRREGULAR, STEADY,
  // INSUFFICIENT_DATA pinned at the bottom.
  const tierRank: Record<CadenceFlag, number> = {
    OVERDUE: 0,
    IRREGULAR: 1,
    STEADY: 2,
    INSUFFICIENT_DATA: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0);
  });

  return {
    rollup: {
      vendorsConsidered: rows.length,
      ...counts,
    },
    rows,
  };
}

function computeMedian(sorted: number[]): number {
  if (sorted.length === 0) return 0;
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid]!;
  return (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
