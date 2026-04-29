// Per-job employee expense rollup.
//
// Plain English: bucket employee expense receipts by jobId.
// Useful for the per-job rebill (these expenses get cost-coded
// to the project even though they came in via the employee
// reimbursement flow).
//
// Per row: jobId, total, totalCents, byCategory,
// distinctEmployees, lastReceiptDate.
//
// Sort by totalCents desc.
//
// Different from expense-by-category (per-category portfolio),
// expense-by-employee (per-employee).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface ExpenseByJobRow {
  jobId: string;
  total: number;
  totalCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  lastReceiptDate: string | null;
}

export interface ExpenseByJobRollup {
  jobsConsidered: number;
  totalCount: number;
  totalCents: number;
  unattributed: number;
}

export interface ExpenseByJobInputs {
  expenses: Expense[];
  /** Optional yyyy-mm-dd window applied to receiptDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildExpenseByJob(
  inputs: ExpenseByJobInputs,
): {
  rollup: ExpenseByJobRollup;
  rows: ExpenseByJobRow[];
} {
  type Acc = {
    jobId: string;
    total: number;
    cents: number;
    cats: Map<ExpenseCategory, number>;
    employees: Set<string>;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let portfolioCount = 0;
  let portfolioCents = 0;
  let unattributed = 0;

  for (const e of inputs.expenses) {
    if (inputs.fromDate && e.receiptDate < inputs.fromDate) continue;
    if (inputs.toDate && e.receiptDate > inputs.toDate) continue;
    portfolioCount += 1;
    portfolioCents += e.amountCents;
    const jobId = (e.jobId ?? '').trim();
    if (!jobId) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(jobId) ?? {
      jobId,
      total: 0,
      cents: 0,
      cats: new Map<ExpenseCategory, number>(),
      employees: new Set<string>(),
      lastDate: null,
    };
    acc.total += 1;
    acc.cents += e.amountCents;
    acc.cats.set(e.category, (acc.cats.get(e.category) ?? 0) + 1);
    acc.employees.add(e.employeeId);
    if (!acc.lastDate || e.receiptDate > acc.lastDate) acc.lastDate = e.receiptDate;
    accs.set(jobId, acc);
  }

  const rows: ExpenseByJobRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      totalCents: acc.cents,
      byCategory: obj,
      distinctEmployees: acc.employees.size,
      lastReceiptDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalCount: portfolioCount,
      totalCents: portfolioCents,
      unattributed,
    },
    rows,
  };
}
