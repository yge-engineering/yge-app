// Per-month subcontractor AP spend.
//
// Plain English: bucket non-DRAFT/non-REJECTED AP invoices by
// month, but ONLY for vendors flagged as SUBCONTRACTOR on the
// vendor master. Surfaces:
//   - sub spend trend month over month
//   - top sub each month + their share
//   - distinct subs paid each month
//   - month-over-month delta
//
// Why this matters: §4104 sub list compliance + DIR / agency
// reporting need to show what we're spending on subs vs. what
// we listed at bid time. A month-by-month sub-spend curve also
// shows seasonal scope shifts (paving subs spike in summer).
//
// Different from:
//   - vendor-spend (portfolio-wide totals across all vendor kinds)
//   - vendor-concentration (top-N share of total AP)
//   - job-sub-spend (per-job sub costs)
//   - sub-scorecard (per-sub performance)
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

export interface MonthlySubSpendRow {
  month: string;
  /** Sum of totalCents on AP invoices to SUBCONTRACTOR vendors. */
  totalSubSpendCents: number;
  invoiceCount: number;
  /** Distinct subs paid in the month. */
  distinctSubs: number;
  /** Top sub (canonical name) by spend that month. Null if zero. */
  topSubName: string | null;
  /** Top sub's share of the month's spend (0..1). 0 when topSubName is null. */
  topSubShare: number;
}

export interface MonthlySubSpendRollup {
  monthsConsidered: number;
  totalSubSpendCents: number;
  totalInvoices: number;
  /** Month with the highest spend. */
  peakMonth: string | null;
  peakSpendCents: number;
  /** Latest month spend minus prior month spend, in cents. 0 when fewer
   *  than 2 months. */
  monthOverMonthChangeCents: number;
}

export interface MonthlySubSpendInputs {
  apInvoices: ApInvoice[];
  vendors: Vendor[];
  /** Optional yyyy-mm window. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildMonthlySubSpend(inputs: MonthlySubSpendInputs): {
  rollup: MonthlySubSpendRollup;
  rows: MonthlySubSpendRow[];
} {
  // Build a Set of canonical sub-vendor names.
  const subNames = new Set<string>();
  for (const v of inputs.vendors) {
    if (v.kind === 'SUBCONTRACTOR') {
      subNames.add(canonicalize(v.legalName));
      if (v.dbaName) subNames.add(canonicalize(v.dbaName));
    }
  }

  type Bucket = {
    month: string;
    totalCents: number;
    invoiceCount: number;
    bySubCents: Map<string, number>;
    bySubDisplay: Map<string, string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.apInvoices) {
    if (inv.status === 'DRAFT' || inv.status === 'REJECTED') continue;
    const key = canonicalize(inv.vendorName);
    if (!subNames.has(key)) continue;
    const month = inv.invoiceDate.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;

    const b = buckets.get(month) ?? {
      month,
      totalCents: 0,
      invoiceCount: 0,
      bySubCents: new Map<string, number>(),
      bySubDisplay: new Map<string, string>(),
    };
    b.totalCents += inv.totalCents;
    b.invoiceCount += 1;
    b.bySubCents.set(key, (b.bySubCents.get(key) ?? 0) + inv.totalCents);
    if (!b.bySubDisplay.has(key)) b.bySubDisplay.set(key, inv.vendorName);
    buckets.set(month, b);
  }

  const rows: MonthlySubSpendRow[] = [];
  for (const b of buckets.values()) {
    let topSub: string | null = null;
    let topAmount = 0;
    for (const [sub, amt] of b.bySubCents.entries()) {
      if (amt > topAmount) {
        topAmount = amt;
        topSub = sub;
      }
    }
    rows.push({
      month: b.month,
      totalSubSpendCents: b.totalCents,
      invoiceCount: b.invoiceCount,
      distinctSubs: b.bySubCents.size,
      topSubName: topSub === null ? null : (b.bySubDisplay.get(topSub) ?? topSub),
      topSubShare: b.totalCents === 0 ? 0 : Math.round((topAmount / b.totalCents) * 10_000) / 10_000,
    });
  }

  rows.sort((a, b) => a.month.localeCompare(b.month));

  // Peak.
  let peakMonth: string | null = null;
  let peakSpend = 0;
  for (const r of rows) {
    if (r.totalSubSpendCents > peakSpend) {
      peakSpend = r.totalSubSpendCents;
      peakMonth = r.month;
    }
  }

  // MoM.
  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.totalSubSpendCents - prev.totalSubSpendCents;
  }

  let totalInvoices = 0;
  let totalCents = 0;
  for (const r of rows) {
    totalInvoices += r.invoiceCount;
    totalCents += r.totalSubSpendCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalSubSpendCents: totalCents,
      totalInvoices,
      peakMonth,
      peakSpendCents: peakSpend,
      monthOverMonthChangeCents: mom,
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
