// Vendor-anchored expense year-over-year.
//
// Plain English: for one vendor (matched via canonicalized
// name), collapse two years of expense receipts into a
// comparison: counts, total cents, category mix, distinct
// employees + jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface VendorExpenseYoyResult {
  vendorName: string;
  priorYear: number;
  currentYear: number;
  priorReceipts: number;
  priorCents: number;
  priorByCategory: Partial<Record<ExpenseCategory, number>>;
  priorDistinctEmployees: number;
  priorDistinctJobs: number;
  currentReceipts: number;
  currentCents: number;
  currentByCategory: Partial<Record<ExpenseCategory, number>>;
  currentDistinctEmployees: number;
  currentDistinctJobs: number;
  centsDelta: number;
}

export interface VendorExpenseYoyInputs {
  vendorName: string;
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

export function buildVendorExpenseYoy(inputs: VendorExpenseYoyInputs): VendorExpenseYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = normVendor(inputs.vendorName);

  type Bucket = {
    receipts: number;
    cents: number;
    byCategory: Map<ExpenseCategory, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { receipts: 0, cents: 0, byCategory: new Map(), employees: new Set(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.expenses) {
    if (normVendor(e.vendor) !== target) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.receipts += 1;
    b.cents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    b.byCategory.set(cat, (b.byCategory.get(cat) ?? 0) + 1);
    b.employees.add(e.employeeId);
    if (e.jobId) b.jobs.add(e.jobId);
  }

  function catRecord(m: Map<ExpenseCategory, number>): Partial<Record<ExpenseCategory, number>> {
    const out: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    vendorName: inputs.vendorName,
    priorYear,
    currentYear: inputs.currentYear,
    priorReceipts: prior.receipts,
    priorCents: prior.cents,
    priorByCategory: catRecord(prior.byCategory),
    priorDistinctEmployees: prior.employees.size,
    priorDistinctJobs: prior.jobs.size,
    currentReceipts: current.receipts,
    currentCents: current.cents,
    currentByCategory: catRecord(current.byCategory),
    currentDistinctEmployees: current.employees.size,
    currentDistinctJobs: current.jobs.size,
    centsDelta: current.cents - prior.cents,
  };
}
