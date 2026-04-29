// Portfolio AR customer activity by month.
//
// Plain English: per yyyy-mm of invoiceDate, sum AR billed +
// paid + retention cents, count distinct customers + jobs +
// invoices. Drives the AR throughput trend the bookkeeper
// scans every month.
//
// Per row: month, totalCents, paidCents, openCents,
// retentionCents, invoiceCount, distinctCustomers, distinctJobs.
//
// Sort: month asc.
//
// Different from monthly-billing (no distinct counts),
// ar-monthly-volume (status mix, no retention), customer-
// revenue-by-month (per customer row).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface PortfolioCustomerMonthlyRow {
  month: string;
  totalCents: number;
  paidCents: number;
  openCents: number;
  retentionCents: number;
  invoiceCount: number;
  distinctCustomers: number;
  distinctJobs: number;
}

export interface PortfolioCustomerMonthlyRollup {
  monthsConsidered: number;
  totalInvoices: number;
  totalCents: number;
  paidCents: number;
  openCents: number;
  retentionCents: number;
}

export interface PortfolioCustomerMonthlyInputs {
  arInvoices: ArInvoice[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioCustomerMonthly(
  inputs: PortfolioCustomerMonthlyInputs,
): {
  rollup: PortfolioCustomerMonthlyRollup;
  rows: PortfolioCustomerMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalCents: number;
    paidCents: number;
    retentionCents: number;
    invoiceCount: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalInvoices = 0;
  let totalCents = 0;
  let paidCents = 0;
  let retentionCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const inv of inputs.arInvoices) {
    const month = inv.invoiceDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalCents: 0,
        paidCents: 0,
        retentionCents: 0,
        invoiceCount: 0,
        customers: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.totalCents += inv.totalCents ?? 0;
    a.paidCents += inv.paidCents ?? 0;
    a.retentionCents += inv.retentionCents ?? 0;
    a.invoiceCount += 1;
    a.customers.add(inv.customerName.toLowerCase().trim());
    a.jobs.add(inv.jobId);

    totalInvoices += 1;
    totalCents += inv.totalCents ?? 0;
    paidCents += inv.paidCents ?? 0;
    retentionCents += inv.retentionCents ?? 0;
  }

  const rows: PortfolioCustomerMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      totalCents: a.totalCents,
      paidCents: a.paidCents,
      openCents: Math.max(0, a.totalCents - a.paidCents),
      retentionCents: a.retentionCents,
      invoiceCount: a.invoiceCount,
      distinctCustomers: a.customers.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalInvoices,
      totalCents,
      paidCents,
      openCents: Math.max(0, totalCents - paidCents),
      retentionCents,
    },
    rows,
  };
}
