// Vendor-anchored job footprint year-over-year.
//
// Plain English: for one vendor (matched via canonicalized
// name), collapse two years of AP + expense activity into a
// comparison: distinct jobs per rail and combined, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface VendorJobYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctJobs: number;
  priorApBilledCents: number;
  priorExpenseReceiptCents: number;
  priorTotalSpendCents: number;
  currentDistinctJobs: number;
  currentApBilledCents: number;
  currentExpenseReceiptCents: number;
  currentTotalSpendCents: number;
  jobsDelta: number;
  totalSpendDelta: number;
}

export interface VendorJobYoyInputs {
  vendorName: string;
  apInvoices: ApInvoice[];
  expenses: Expense[];
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

export function buildVendorJobYoy(inputs: VendorJobYoyInputs): VendorJobYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Bucket = { jobs: Set<string>; apCents: number; expCents: number };
  function emptyBucket(): Bucket {
    return { jobs: new Set(), apCents: 0, expCents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.apInvoices) {
    if (normVendor(inv.vendorName) !== target) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    if (inv.jobId) b.jobs.add(inv.jobId);
    b.apCents += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    if (e.jobId) b.jobs.add(e.jobId);
    b.expCents += e.amountCents;
  }

  const priorTotal = prior.apCents + prior.expCents;
  const currentTotal = current.apCents + current.expCents;

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctJobs: prior.jobs.size,
    priorApBilledCents: prior.apCents,
    priorExpenseReceiptCents: prior.expCents,
    priorTotalSpendCents: priorTotal,
    currentDistinctJobs: current.jobs.size,
    currentApBilledCents: current.apCents,
    currentExpenseReceiptCents: current.expCents,
    currentTotalSpendCents: currentTotal,
    jobsDelta: current.jobs.size - prior.jobs.size,
    totalSpendDelta: currentTotal - priorTotal,
  };
}
