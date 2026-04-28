// AR invoice source mix.
//
// Plain English: AR invoices come from four sources — MANUAL
// (typed by the bookkeeper), DAILY_REPORTS (auto-built from
// foreman DR cost-coding), PROGRESS (pay-app schedule of
// values), LUMP_SUM (single-line). The mix tells how mature our
// billing automation is — over time PROGRESS + DAILY_REPORTS
// should grow, MANUAL should shrink.
//
// Per row: source, count, totalCents, avgCents, distinctJobs,
// distinctCustomers, share (of total \$).
//
// Sort by totalCents desc.
//
// Different from monthly-billing (per month), ar-monthly-volume
// (per month), and customer-month-matrix (customer × month).
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceSource } from './ar-invoice';

export interface ArInvoiceSourceMixRow {
  source: ArInvoiceSource;
  count: number;
  totalCents: number;
  avgCents: number;
  distinctJobs: number;
  distinctCustomers: number;
  share: number;
}

export interface ArInvoiceSourceMixRollup {
  sourcesConsidered: number;
  totalCount: number;
  totalCents: number;
}

export interface ArInvoiceSourceMixInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildArInvoiceSourceMix(
  inputs: ArInvoiceSourceMixInputs,
): {
  rollup: ArInvoiceSourceMixRollup;
  rows: ArInvoiceSourceMixRow[];
} {
  type Acc = {
    count: number;
    total: number;
    jobs: Set<string>;
    customers: Set<string>;
  };
  const accs = new Map<ArInvoiceSource, Acc>();
  let portfolioCount = 0;
  let portfolioTotal = 0;

  for (const inv of inputs.arInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    portfolioCount += 1;
    portfolioTotal += inv.totalCents;
    const acc = accs.get(inv.source) ?? {
      count: 0,
      total: 0,
      jobs: new Set<string>(),
      customers: new Set<string>(),
    };
    acc.count += 1;
    acc.total += inv.totalCents;
    acc.jobs.add(inv.jobId);
    acc.customers.add(canonicalize(inv.customerName));
    accs.set(inv.source, acc);
  }

  const rows: ArInvoiceSourceMixRow[] = [];
  for (const [source, acc] of accs.entries()) {
    const avg = acc.count === 0 ? 0 : Math.round(acc.total / acc.count);
    const share = portfolioTotal === 0
      ? 0
      : Math.round((acc.total / portfolioTotal) * 10_000) / 10_000;
    rows.push({
      source,
      count: acc.count,
      totalCents: acc.total,
      avgCents: avg,
      distinctJobs: acc.jobs.size,
      distinctCustomers: acc.customers.size,
      share,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      sourcesConsidered: rows.length,
      totalCount: portfolioCount,
      totalCents: portfolioTotal,
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
