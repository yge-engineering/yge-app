// Job-anchored vendor footprint year-over-year.
//
// Plain English: for one job, collapse two years of AP +
// expense vendors into a comparison: distinct vendors per
// rail and combined, total spend, plus deltas.
//
// Pure derivation. No persisted records.

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

export interface JobVendorYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctVendors: number;
  priorApBilledCents: number;
  priorExpenseReceiptCents: number;
  priorTotalSpendCents: number;
  currentDistinctVendors: number;
  currentApBilledCents: number;
  currentExpenseReceiptCents: number;
  currentTotalSpendCents: number;
  totalSpendDelta: number;
}

export interface JobVendorYoyInputs {
  jobId: string;
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

export function buildJobVendorYoy(inputs: JobVendorYoyInputs): JobVendorYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    apVendors: Set<string>;
    expenseVendors: Set<string>;
    apCents: number;
    expCents: number;
  };
  function emptyBucket(): Bucket {
    return { apVendors: new Set(), expenseVendors: new Set(), apCents: 0, expCents: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const inv of inputs.apInvoices) {
    if (inv.jobId !== inputs.jobId) continue;
    const year = Number(inv.invoiceDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.apVendors.add(normVendor(inv.vendorName));
    b.apCents += inv.totalCents ?? 0;
  }
  for (const e of inputs.expenses) {
    if (e.jobId !== inputs.jobId) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.expenseVendors.add(normVendor(e.vendor));
    b.expCents += e.amountCents;
  }

  const priorAll = new Set<string>([...prior.apVendors, ...prior.expenseVendors]);
  const currentAll = new Set<string>([...current.apVendors, ...current.expenseVendors]);
  const priorTotal = prior.apCents + prior.expCents;
  const currentTotal = current.apCents + current.expCents;

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctVendors: priorAll.size,
    priorApBilledCents: prior.apCents,
    priorExpenseReceiptCents: prior.expCents,
    priorTotalSpendCents: priorTotal,
    currentDistinctVendors: currentAll.size,
    currentApBilledCents: current.apCents,
    currentExpenseReceiptCents: current.expCents,
    currentTotalSpendCents: currentTotal,
    totalSpendDelta: currentTotal - priorTotal,
  };
}
