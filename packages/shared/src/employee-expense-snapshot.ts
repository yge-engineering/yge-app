// Employee-anchored expense snapshot.
//
// Plain English: for one employee, as-of today, count expense
// receipts, sum cents, category mix, reimbursable / reimbursed
// / pending, distinct jobs + vendors, last receipt date.
// Drives the right-now per-employee expense reimbursement
// overview.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

import { expenseReimbursableCents } from './expense';

export interface EmployeeExpenseSnapshotResult {
  asOf: string;
  employeeId: string;
  totalReceipts: number;
  totalCents: number;
  reimbursableCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctJobs: number;
  distinctVendors: number;
  lastReceiptDate: string | null;
}

export interface EmployeeExpenseSnapshotInputs {
  employeeId: string;
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

function normVendor(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b(llc|inc|corp|co|ltd|company)\b/g, '')
    .replace(/[.,&'()]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildEmployeeExpenseSnapshot(
  inputs: EmployeeExpenseSnapshotInputs,
): EmployeeExpenseSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byCategory = new Map<ExpenseCategory, number>();
  const jobs = new Set<string>();
  const vendors = new Set<string>();
  let totalReceipts = 0;
  let totalCents = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  let pendingReimbursementCents = 0;
  let lastReceiptDate: string | null = null;

  for (const e of inputs.expenses) {
    if (e.employeeId !== inputs.employeeId) continue;
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    if (e.jobId) jobs.add(e.jobId);
    if (e.vendor) vendors.add(normVendor(e.vendor));
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
    employeeId: inputs.employeeId,
    totalReceipts,
    totalCents,
    reimbursableCents,
    reimbursedCents,
    pendingReimbursementCents,
    byCategory: out,
    distinctJobs: jobs.size,
    distinctVendors: vendors.size,
    lastReceiptDate,
  };
}
