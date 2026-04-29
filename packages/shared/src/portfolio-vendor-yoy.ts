// Portfolio AP vendor activity year-over-year.
//
// Plain English: collapse two years of AP invoices into a
// single comparison row with totals, paid, open, distinct
// vendors, distinct jobs, plus deltas.
//
// Different from portfolio-vendor-monthly (per month).
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';

export interface PortfolioVendorYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalCents: number;
  priorPaidCents: number;
  priorOpenCents: number;
  priorInvoiceCount: number;
  priorDistinctVendors: number;
  priorDistinctJobs: number;
  currentTotalCents: number;
  currentPaidCents: number;
  currentOpenCents: number;
  currentInvoiceCount: number;
  currentDistinctVendors: number;
  currentDistinctJobs: number;
  totalCentsDelta: number;
  invoiceCountDelta: number;
}

export interface PortfolioVendorYoyInputs {
  apInvoices: ApInvoice[];
  currentYear: number;
}

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildPortfolioVendorYoy(
  inputs: PortfolioVendorYoyInputs,
): PortfolioVendorYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalCents: number;
    paidCents: number;
    invoiceCount: number;
    vendors: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalCents: 0,
      paidCents: 0,
      invoiceCount: 0,
      vendors: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.apInvoices) {
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalCents += inv.totalCents ?? 0;
    b.paidCents += inv.paidCents ?? 0;
    b.invoiceCount += 1;
    b.vendors.add(normVendor(inv.vendorName));
    if (inv.jobId) b.jobs.add(inv.jobId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalCents: prior.totalCents,
    priorPaidCents: prior.paidCents,
    priorOpenCents: Math.max(0, prior.totalCents - prior.paidCents),
    priorInvoiceCount: prior.invoiceCount,
    priorDistinctVendors: prior.vendors.size,
    priorDistinctJobs: prior.jobs.size,
    currentTotalCents: current.totalCents,
    currentPaidCents: current.paidCents,
    currentOpenCents: Math.max(0, current.totalCents - current.paidCents),
    currentInvoiceCount: current.invoiceCount,
    currentDistinctVendors: current.vendors.size,
    currentDistinctJobs: current.jobs.size,
    totalCentsDelta: current.totalCents - prior.totalCents,
    invoiceCountDelta: current.invoiceCount - prior.invoiceCount,
  };
}
