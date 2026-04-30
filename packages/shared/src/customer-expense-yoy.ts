// Customer-anchored expense year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of expense receipts into a comparison:
// counts, total cents, category mix, distinct employees + jobs,
// reimbursable cents, plus deltas.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';
import type { Job } from './job';

import { expenseReimbursableCents } from './expense';

export interface CustomerExpenseYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorReceipts: number;
  priorCents: number;
  priorReimbursableCents: number;
  priorByCategory: Partial<Record<ExpenseCategory, number>>;
  priorDistinctEmployees: number;
  priorDistinctJobs: number;
  currentReceipts: number;
  currentCents: number;
  currentReimbursableCents: number;
  currentByCategory: Partial<Record<ExpenseCategory, number>>;
  currentDistinctEmployees: number;
  currentDistinctJobs: number;
  receiptsDelta: number;
  centsDelta: number;
}

export interface CustomerExpenseYoyInputs {
  customerName: string;
  expenses: Expense[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerExpenseYoy(
  inputs: CustomerExpenseYoyInputs,
): CustomerExpenseYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    receipts: number;
    cents: number;
    reimb: number;
    byCategory: Map<ExpenseCategory, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { receipts: 0, cents: 0, reimb: 0, byCategory: new Map(), employees: new Set(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const e of inputs.expenses) {
    if (!e.jobId || !customerJobs.has(e.jobId)) continue;
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
    b.employees.add(e.employeeId);
    b.jobs.add(e.jobId);
  }

  function catRecord(m: Map<ExpenseCategory, number>): Partial<Record<ExpenseCategory, number>> {
    const out: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorReceipts: prior.receipts,
    priorCents: prior.cents,
    priorReimbursableCents: prior.reimb,
    priorByCategory: catRecord(prior.byCategory),
    priorDistinctEmployees: prior.employees.size,
    priorDistinctJobs: prior.jobs.size,
    currentReceipts: current.receipts,
    currentCents: current.cents,
    currentReimbursableCents: current.reimb,
    currentByCategory: catRecord(current.byCategory),
    currentDistinctEmployees: current.employees.size,
    currentDistinctJobs: current.jobs.size,
    receiptsDelta: current.receipts - prior.receipts,
    centsDelta: current.cents - prior.cents,
  };
}
