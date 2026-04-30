// Job-anchored expense snapshot.
//
// Plain English: for one job, as-of today, count expense
// receipts, sum cents, break down by category, separate
// reimbursable / reimbursed / pending cents, count distinct
// employees, surface last receipt date. Drives the right-now
// per-job out-of-pocket overview.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

import { expenseReimbursableCents } from './expense';

export interface JobExpenseSnapshotResult {
  asOf: string;
  jobId: string;
  totalReceipts: number;
  totalCents: number;
  reimbursableCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  lastReceiptDate: string | null;
}

export interface JobExpenseSnapshotInputs {
  jobId: string;
  expenses: Expense[];
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

export function buildJobExpenseSnapshot(
  inputs: JobExpenseSnapshotInputs,
): JobExpenseSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byCategory = new Map<ExpenseCategory, number>();
  const employees = new Set<string>();
  let totalReceipts = 0;
  let totalCents = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  let pendingReimbursementCents = 0;
  let lastReceiptDate: string | null = null;

  for (const e of inputs.expenses) {
    if (e.jobId !== inputs.jobId) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    employees.add(e.employeeId);
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
    jobId: inputs.jobId,
    totalReceipts,
    totalCents,
    reimbursableCents,
    reimbursedCents,
    pendingReimbursementCents,
    byCategory: out,
    distinctEmployees: employees.size,
    lastReceiptDate,
  };
}
