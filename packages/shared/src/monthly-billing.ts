// Per-month AR billing volume.
//
// Plain English: bucket every non-DRAFT AR invoice by the month
// it was sent, then roll up portfolio-wide. Tells the office
// whether billing is keeping pace month over month, and surfaces
// month-over-month change so a slowdown is visible the day it
// starts.
//
// Different from:
//   - daily-ar-billing (per-day across all jobs)
//   - billing-pace (estimated-vs-actual cadence)
//   - job-billing-cadence (per-job timing)
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface MonthlyBillingRow {
  month: string;
  invoiceCount: number;
  totalBilledCents: number;
  /** Sum of paidCents across the month's invoices. */
  totalPaidCents: number;
  /** totalBilledCents - totalPaidCents. */
  outstandingCents: number;
  /** Unique customers billed that month. */
  distinctCustomers: number;
  /** Unique jobs billed that month. */
  distinctJobs: number;
}

export interface MonthlyBillingRollup {
  monthsConsidered: number;
  totalInvoices: number;
  totalBilledCents: number;
  totalPaidCents: number;
  /** Month with the highest totalBilledCents. */
  peakMonth: string | null;
  peakBilledCents: number;
  /** Latest month vs prior month delta in billed cents.
   *  Positive = trending up. 0 when fewer than 2 months. */
  monthOverMonthChangeCents: number;
}

export interface MonthlyBillingInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm bounds. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildMonthlyBilling(inputs: MonthlyBillingInputs): {
  rollup: MonthlyBillingRollup;
  rows: MonthlyBillingRow[];
} {
  type Bucket = {
    month: string;
    count: number;
    billed: number;
    paid: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (inv.status === 'DRAFT') continue;
    // We bucket by createdAt's first 10 chars (yyyy-mm-dd → yyyy-mm).
    // Caller can pre-window if they want a different sent-date.
    const date = inv.createdAt.slice(0, 10);
    if (date.length < 10) continue;
    const month = date.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;

    const b = buckets.get(month) ?? {
      month,
      count: 0,
      billed: 0,
      paid: 0,
      customers: new Set<string>(),
      jobs: new Set<string>(),
    };
    b.count += 1;
    // totalCents is computed from line items but stored on the invoice
    // header. ar-invoice has lineTotalCents on each line and a
    // headerless total — sum line totals here for resilience.
    let invTotal = 0;
    for (const li of inv.lineItems) invTotal += li.lineTotalCents;
    b.billed += invTotal;
    b.paid += inv.paidCents;
    b.customers.add(canonicalize(inv.customerName));
    b.jobs.add(inv.jobId);
    buckets.set(month, b);
  }

  const rows: MonthlyBillingRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      invoiceCount: b.count,
      totalBilledCents: b.billed,
      totalPaidCents: b.paid,
      outstandingCents: b.billed - b.paid,
      distinctCustomers: b.customers.size,
      distinctJobs: b.jobs.size,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Peak.
  let peakMonth: string | null = null;
  let peakBilled = 0;
  for (const r of rows) {
    if (r.totalBilledCents > peakBilled) {
      peakBilled = r.totalBilledCents;
      peakMonth = r.month;
    }
  }

  // Month-over-month.
  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) {
      mom = last.totalBilledCents - prev.totalBilledCents;
    }
  }

  let totalInvoices = 0;
  let totalBilled = 0;
  let totalPaid = 0;
  for (const r of rows) {
    totalInvoices += r.invoiceCount;
    totalBilled += r.totalBilledCents;
    totalPaid += r.totalPaidCents;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalInvoices,
      totalBilledCents: totalBilled,
      totalPaidCents: totalPaid,
      peakMonth,
      peakBilledCents: peakBilled,
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
