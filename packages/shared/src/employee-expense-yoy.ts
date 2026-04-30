// Employee-anchored expense year-over-year.
//
// Plain English: for one employee, collapse two years of
// expense receipts into a comparison: counts, total cents,
// reimbursable cents, category mix, distinct jobs + vendors,
// plus deltas.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

import { expenseReimbursableCents } from './expense';

export interface EmployeeExpenseYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorReceipts: number;
  priorCents: number;
  priorReimbursableCents: number;
  priorByCategory: Partial<Record<ExpenseCategory, number>>;
  priorDistinctJobs: number;
  priorDistinctVendors: number;
  currentReceipts: number;
  currentCents: number;
  currentReimbursableCents: number;
  currentByCategory: Partial<Record<ExpenseCategory, number>>;
  currentDistinctJobs: number;
  currentDistinctVendors: number;
  centsDelta: number;
}

export interface EmployeeExpenseYoyInputs {
  employeeId: string;
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

export function buildEmployeeExpenseYoy(
  inputs: EmployeeExpenseYoyInputs,
): EmployeeExpenseYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    receipts: number;
    cents: number;
    reimb: number;
    byCategory: Map<ExpenseCategory, number>;
    jobs: Set<string>;
    vendors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { receipts: 0, cents: 0, reimb: 0, byCategory: new Map(), jobs: new Set(), vendors: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.expenses) {
    if (e.employeeId !== inputs.employeeId) continue;
    const year = Number(e.receiptDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.receipts += 1;
    b.cents += e.amountCents;
    b.reimb += expenseReimbursableCents(e);
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    b.byCategory.set(cat, (b.byCategory.get(cat) ?? 0) + 1);
    if (e.jobId) b.jobs.add(e.jobId);
    if (e.vendor) b.vendors.add(normVendor(e.vendor));
  }

  function catRecord(m: Map<ExpenseCategory, number>): Partial<Record<ExpenseCategory, number>> {
    const out: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorReceipts: prior.receipts,
    priorCents: prior.cents,
    priorReimbursableCents: prior.reimb,
    priorByCategory: catRecord(prior.byCategory),
    priorDistinctJobs: prior.jobs.size,
    priorDistinctVendors: prior.vendors.size,
    currentReceipts: current.receipts,
    currentCents: current.cents,
    currentReimbursableCents: current.reimb,
    currentByCategory: catRecord(current.byCategory),
    currentDistinctJobs: current.jobs.size,
    currentDistinctVendors: current.vendors.size,
    centsDelta: current.cents - prior.cents,
  };
}
