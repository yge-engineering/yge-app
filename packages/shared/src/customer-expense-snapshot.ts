// Customer-anchored expense snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count expense receipts on their jobs, sum
// cents, category mix, reimbursable / reimbursed / pending,
// distinct employees + jobs, last receipt date.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';
import type { Job } from './job';

import { expenseReimbursableCents } from './expense';

export interface CustomerExpenseSnapshotResult {
  asOf: string;
  customerName: string;
  totalReceipts: number;
  totalCents: number;
  reimbursableCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  distinctJobs: number;
  lastReceiptDate: string | null;
}

export interface CustomerExpenseSnapshotInputs {
  customerName: string;
  expenses: Expense[];
  jobs: Job[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerExpenseSnapshot(
  inputs: CustomerExpenseSnapshotInputs,
): CustomerExpenseSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byCategory = new Map<ExpenseCategory, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();
  let totalReceipts = 0;
  let totalCents = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  let pendingReimbursementCents = 0;
  let lastReceiptDate: string | null = null;

  for (const e of inputs.expenses) {
    if (!e.jobId || !jobIds.has(e.jobId)) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    employees.add(e.employeeId);
    jobs.add(e.jobId);
    const reimb = expenseReimbursableCents(e);
    reimbursableCents += reimb;
    if (e.reimbursed) reimbursedCents += reimb;
    else pendingReimbursementCents += reimb;
    if (lastReceiptDate == null || e.receiptDate > lastReceiptDate) lastReceiptDate = e.receiptDate;
  }

  const out: Partial<Record<ExpenseCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalReceipts,
    totalCents,
    reimbursableCents,
    reimbursedCents,
    pendingReimbursementCents,
    byCategory: out,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
    lastReceiptDate,
  };
}
