// Per-customer revenue trend by month.
//
// Plain English: customer-concentration shows total share. This
// module unrolls that across months so we can see whether each
// customer is growing, shrinking, seasonal, or steady. The
// shape of the trend tells us:
//   - growing customers are worth bidding more aggressively
//   - shrinking customers may be running out of contract
//   - seasonal patterns shape next-year capacity planning
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export type RevenueTrendDirection =
  | 'GROWING'
  | 'STEADY'
  | 'SHRINKING'
  | 'SEASONAL'   // wide spread between best/worst months
  | 'INSUFFICIENT_DATA';

export interface MonthRevenueCell {
  yearMonth: string; // yyyy-mm
  billedCents: number;
  invoiceCount: number;
}

export interface CustomerRevenueTrendRow {
  customerName: string;
  totalBilledCents: number;
  monthsWithRevenue: number;
  /** Time-ordered cells across the window. */
  monthlyCells: MonthRevenueCell[];
  /** Best + worst month $ in the window. */
  peakMonthCents: number;
  troughMonthCents: number;
  /** Linear-fit slope in cents per month — positive = growing,
   *  negative = shrinking. Null when <3 months of data. */
  monthlySlopeCents: number | null;
  direction: RevenueTrendDirection;
}

export interface RevenueTrendRollup {
  customersConsidered: number;
  totalBilledCents: number;
  growing: number;
  steady: number;
  shrinking: number;
  seasonal: number;
  insufficient: number;
}

export interface RevenueTrendInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  arInvoices: ArInvoice[];
  /** When true (default), case-insensitively merge customer names. */
  caseInsensitive?: boolean;
}

export function buildCustomerRevenueTrend(
  inputs: RevenueTrendInputs,
): {
  rollup: RevenueTrendRollup;
  rows: CustomerRevenueTrendRow[];
} {
  const caseInsensitive = inputs.caseInsensitive !== false;

  type Bucket = {
    customerName: string;
    monthly: Map<string, { billed: number; count: number }>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'WRITTEN_OFF') continue;
    if (inv.invoiceDate < inputs.fromDate) continue;
    if (inv.invoiceDate > inputs.toDate) continue;

    const key = caseInsensitive
      ? inv.customerName.trim().toLowerCase()
      : inv.customerName.trim();
    const ym = inv.invoiceDate.slice(0, 7);
    const b = buckets.get(key) ?? {
      customerName: inv.customerName.trim(),
      monthly: new Map<string, { billed: number; count: number }>(),
    };
    const cell = b.monthly.get(ym) ?? { billed: 0, count: 0 };
    cell.billed += inv.totalCents;
    cell.count += 1;
    b.monthly.set(ym, cell);
    buckets.set(key, b);
  }

  const rows: CustomerRevenueTrendRow[] = [];
  const counts = {
    growing: 0,
    steady: 0,
    shrinking: 0,
    seasonal: 0,
    insufficient: 0,
  };
  let grandTotal = 0;

  for (const b of buckets.values()) {
    const sortedMonths = Array.from(b.monthly.keys()).sort();
    const cells: MonthRevenueCell[] = sortedMonths.map((ym) => {
      const c = b.monthly.get(ym)!;
      return { yearMonth: ym, billedCents: c.billed, invoiceCount: c.count };
    });
    let total = 0;
    let peak = 0;
    let trough = Infinity;
    for (const c of cells) {
      total += c.billedCents;
      if (c.billedCents > peak) peak = c.billedCents;
      if (c.billedCents < trough) trough = c.billedCents;
    }
    if (cells.length === 0) trough = 0;

    let slope: number | null = null;
    let direction: RevenueTrendDirection;
    if (cells.length < 3) {
      direction = 'INSUFFICIENT_DATA';
    } else {
      slope = computeSlope(cells.map((c) => c.billedCents));
      const avg = total / cells.length;
      const spread = avg === 0 ? 0 : (peak - trough) / avg;
      if (spread > 1.5 && Math.abs(slope) < avg * 0.15) {
        direction = 'SEASONAL';
      } else if (slope > avg * 0.05) direction = 'GROWING';
      else if (slope < -avg * 0.05) direction = 'SHRINKING';
      else direction = 'STEADY';
    }

    rows.push({
      customerName: b.customerName,
      totalBilledCents: total,
      monthsWithRevenue: cells.length,
      monthlyCells: cells,
      peakMonthCents: peak,
      troughMonthCents: trough,
      monthlySlopeCents: slope === null ? null : Math.round(slope),
      direction,
    });
    grandTotal += total;
    if (direction === 'GROWING') counts.growing += 1;
    else if (direction === 'SHRINKING') counts.shrinking += 1;
    else if (direction === 'SEASONAL') counts.seasonal += 1;
    else if (direction === 'STEADY') counts.steady += 1;
    else counts.insufficient += 1;
  }

  // Highest total revenue first.
  rows.sort((a, b) => b.totalBilledCents - a.totalBilledCents);

  return {
    rollup: {
      customersConsidered: rows.length,
      totalBilledCents: grandTotal,
      ...counts,
    },
    rows,
  };
}

/** Simple least-squares slope on (i, value) for i = 0..n-1. */
function computeSlope(values: number[]): number {
  const n = values.length;
  if (n < 2) return 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  for (let i = 0; i < n; i += 1) {
    const x = i;
    const y = values[i]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumXX += x * x;
  }
  const denom = n * sumXX - sumX * sumX;
  if (denom === 0) return 0;
  return (n * sumXY - sumX * sumY) / denom;
}
