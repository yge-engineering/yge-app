// Daily AR billing volume.
//
// Plain English: how many AR invoices got issued each day in the
// window? Most YGE billing happens monthly, so the report shape
// is "spike on the 1st, sparse the rest of the month." A spike
// missing on the 1st of a month is the early-warning that
// somebody fell behind on bills. The pattern also surfaces
// week-end vs month-end billing rhythm tuning.
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface DailyArBillingRow {
  date: string;
  invoiceCount: number;
  billedCents: number;
  distinctCustomers: number;
  distinctJobs: number;
}

export interface DailyArBillingRollup {
  daysWithBilling: number;
  totalInvoiceCount: number;
  totalBilledCents: number;
  /** Single-day peak invoice count. */
  peakInvoiceCount: number;
  peakInvoiceDate: string | null;
  avgPerActiveDayCents: number;
}

export interface DailyArBillingInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  arInvoices: ArInvoice[];
  /** When true (default), skip DRAFT invoices — they aren't out
   *  the door yet. */
  skipDrafts?: boolean;
}

export function buildDailyArBilling(inputs: DailyArBillingInputs): {
  rollup: DailyArBillingRollup;
  rows: DailyArBillingRow[];
} {
  const skipDrafts = inputs.skipDrafts !== false;

  type Bucket = {
    date: string;
    count: number;
    billed: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const buckets = new Map<string, Bucket>();

  for (const inv of inputs.arInvoices) {
    if (skipDrafts && inv.status === 'DRAFT') continue;
    if (inv.invoiceDate < inputs.fromDate) continue;
    if (inv.invoiceDate > inputs.toDate) continue;
    const b = buckets.get(inv.invoiceDate) ?? {
      date: inv.invoiceDate,
      count: 0,
      billed: 0,
      customers: new Set<string>(),
      jobs: new Set<string>(),
    };
    b.count += 1;
    b.billed += inv.totalCents;
    b.customers.add(inv.customerName.trim().toLowerCase());
    b.jobs.add(inv.jobId);
    buckets.set(inv.invoiceDate, b);
  }

  const rows: DailyArBillingRow[] = [];
  let totalCount = 0;
  let totalBilled = 0;
  let peak = 0;
  let peakDate: string | null = null;

  for (const b of buckets.values()) {
    rows.push({
      date: b.date,
      invoiceCount: b.count,
      billedCents: b.billed,
      distinctCustomers: b.customers.size,
      distinctJobs: b.jobs.size,
    });
    totalCount += b.count;
    totalBilled += b.billed;
    if (b.count > peak) {
      peak = b.count;
      peakDate = b.date;
    }
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rollup: {
      daysWithBilling: rows.length,
      totalInvoiceCount: totalCount,
      totalBilledCents: totalBilled,
      peakInvoiceCount: peak,
      peakInvoiceDate: peakDate,
      avgPerActiveDayCents:
        rows.length === 0 ? 0 : Math.round(totalBilled / rows.length),
    },
    rows,
  };
}
