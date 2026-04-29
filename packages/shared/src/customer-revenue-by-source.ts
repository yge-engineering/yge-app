// Per-customer AR revenue by source.
//
// Plain English: roll AR invoices up by (customer, source) —
// MANUAL / DAILY_REPORTS / PROGRESS / LUMP_SUM. Tracks billing-
// automation maturity per customer (the more PROGRESS +
// DAILY_REPORTS share each customer's revenue, the more
// systematized our pay-app cycle for them is).
//
// Per row: customerName, source, totalCents, invoiceCount,
// distinctJobs.
//
// Sort: customerName asc, totalCents desc within customer.
//
// Different from ar-invoice-source-mix (portfolio breakdown by
// source), customer-revenue-by-month (per-month per-customer),
// customer-month-matrix.
//
// Pure derivation. No persisted records.

import type { ArInvoice, ArInvoiceSource } from './ar-invoice';

export interface CustomerRevenueBySourceRow {
  customerName: string;
  source: ArInvoiceSource;
  totalCents: number;
  invoiceCount: number;
  distinctJobs: number;
}

export interface CustomerRevenueBySourceRollup {
  customersConsidered: number;
  sourcesConsidered: number;
  totalCents: number;
}

export interface CustomerRevenueBySourceInputs {
  arInvoices: ArInvoice[];
  /** Optional yyyy-mm-dd window applied to invoiceDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildCustomerRevenueBySource(
  inputs: CustomerRevenueBySourceInputs,
): {
  rollup: CustomerRevenueBySourceRollup;
  rows: CustomerRevenueBySourceRow[];
} {
  type Acc = {
    display: string;
    source: ArInvoiceSource;
    cents: number;
    invoices: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customerSet = new Set<string>();
  const sourceSet = new Set<ArInvoiceSource>();
  let totalCents = 0;

  for (const inv of inputs.arInvoices) {
    if (inputs.fromDate && inv.invoiceDate < inputs.fromDate) continue;
    if (inputs.toDate && inv.invoiceDate > inputs.toDate) continue;
    const canonical = canonicalize(inv.customerName);
    const key = `${canonical}|${inv.source}`;
    const acc = accs.get(key) ?? {
      display: inv.customerName,
      source: inv.source,
      cents: 0,
      invoices: 0,
      jobs: new Set<string>(),
    };
    acc.cents += inv.totalCents;
    acc.invoices += 1;
    acc.jobs.add(inv.jobId);
    accs.set(key, acc);
    customerSet.add(canonical);
    sourceSet.add(inv.source);
    totalCents += inv.totalCents;
  }

  const rows: CustomerRevenueBySourceRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      customerName: acc.display,
      source: acc.source,
      totalCents: acc.cents,
      invoiceCount: acc.invoices,
      distinctJobs: acc.jobs.size,
    });
  }

  rows.sort((a, b) => {
    if (a.customerName !== b.customerName) return a.customerName.localeCompare(b.customerName);
    return b.totalCents - a.totalCents;
  });

  return {
    rollup: {
      customersConsidered: customerSet.size,
      sourcesConsidered: sourceSet.size,
      totalCents,
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
