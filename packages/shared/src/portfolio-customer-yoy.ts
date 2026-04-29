// Portfolio AR customer activity year-over-year.
//
// Plain English: collapse two years of AR invoices into a
// single comparison row with billed, paid, open, retention,
// distinct customers + jobs, plus deltas.
//
// Different from portfolio-customer-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ArInvoice } from './ar-invoice';

export interface PortfolioCustomerYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalCents: number;
  priorPaidCents: number;
  priorOpenCents: number;
  priorRetentionCents: number;
  priorInvoiceCount: number;
  priorDistinctCustomers: number;
  priorDistinctJobs: number;
  currentTotalCents: number;
  currentPaidCents: number;
  currentOpenCents: number;
  currentRetentionCents: number;
  currentInvoiceCount: number;
  currentDistinctCustomers: number;
  currentDistinctJobs: number;
  totalCentsDelta: number;
  invoiceCountDelta: number;
}

export interface PortfolioCustomerYoyInputs {
  arInvoices: ArInvoice[];
  currentYear: number;
}

export function buildPortfolioCustomerYoy(
  inputs: PortfolioCustomerYoyInputs,
): PortfolioCustomerYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalCents: number;
    paidCents: number;
    retentionCents: number;
    invoiceCount: number;
    customers: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalCents: 0,
      paidCents: 0,
      retentionCents: 0,
      invoiceCount: 0,
      customers: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.arInvoices) {
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalCents += inv.totalCents ?? 0;
    b.paidCents += inv.paidCents ?? 0;
    b.retentionCents += inv.retentionCents ?? 0;
    b.invoiceCount += 1;
    b.customers.add(inv.customerName.toLowerCase().trim());
    b.jobs.add(inv.jobId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalCents: prior.totalCents,
    priorPaidCents: prior.paidCents,
    priorOpenCents: Math.max(0, prior.totalCents - prior.paidCents),
    priorRetentionCents: prior.retentionCents,
    priorInvoiceCount: prior.invoiceCount,
    priorDistinctCustomers: prior.customers.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotalCents: current.totalCents,
    currentPaidCents: current.paidCents,
    currentOpenCents: Math.max(0, current.totalCents - current.paidCents),
    currentRetentionCents: current.retentionCents,
    currentInvoiceCount: current.invoiceCount,
    currentDistinctCustomers: current.customers.size,
    currentDistinctJobs: current.jobs.size,
    totalCentsDelta: current.totalCents - prior.totalCents,
    invoiceCountDelta: current.invoiceCount - prior.invoiceCount,
  };
}
