// Portfolio expense snapshot.
//
// Plain English: as-of today, count receipts, sum cents, break
// down by category, separate company-card vs out-of-pocket, count
// pending vs reimbursed, count distinct employees + jobs, and
// surface YTD totals. Drives the right-now expense overview.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

import { expenseReimbursableCents } from './expense';

export interface PortfolioExpenseSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalReceipts: number;
  ytdReceipts: number;
  totalCents: number;
  ytdCents: number;
  reimbursableCents: number;
  reimbursedCents: number;
  pendingReimbursementCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioExpenseSnapshotInputs {
  expenses: Expense[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioExpenseSnapshot(
  inputs: PortfolioExpenseSnapshotInputs,
): PortfolioExpenseSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byCategory = new Map<ExpenseCategory, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();

  let totalReceipts = 0;
  let ytdReceipts = 0;
  let totalCents = 0;
  let ytdCents = 0;
  let reimbursableCents = 0;
  let reimbursedCents = 0;
  let pendingReimbursementCents = 0;

  for (const e of inputs.expenses) {
    if (e.receiptDate > asOf) continue;
    totalReceipts += 1;
    totalCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    byCategory.set(cat, (byCategory.get(cat) ?? 0) + 1);
    employees.add(e.employeeId);
    if (e.jobId) jobs.add(e.jobId);
    const reimb = expenseReimbursableCents(e);
    reimbursableCents += reimb;
    if (e.reimbursed) reimbursedCents += reimb;
    else pendingReimbursementCents += reimb;
    if (Number(e.receiptDate.slice(0, 4)) === logYear) {
      ytdReceipts += 1;
      ytdCents += e.amountCents;
    }
  }

  const out: Partial<Record<ExpenseCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalReceipts,
    ytdReceipts,
    totalCents,
    ytdCents,
    reimbursableCents,
    reimbursedCents,
    pendingReimbursementCents,
    byCategory: out,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
  };
}
