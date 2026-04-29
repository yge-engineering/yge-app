// Portfolio employee expense activity by month.
//
// Plain English: per yyyy-mm of receiptDate, count receipts,
// sum cents + reimbursed cents, break down by category,
// distinct employees + jobs. Drives the AP/payroll office's
// monthly out-of-pocket review.
//
// Per row: month, count, totalCents, reimbursedCents,
// byCategory, distinctEmployees, distinctJobs.
//
// Sort: month asc.
//
// Different from expense-by-category-monthly (per category
// row), expense-by-job-monthly (per job axis), customer-
// expense-monthly (per customer).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface PortfolioExpenseMonthlyRow {
  month: string;
  count: number;
  totalCents: number;
  reimbursedCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioExpenseMonthlyRollup {
  monthsConsidered: number;
  totalReceipts: number;
  totalCents: number;
  reimbursedCents: number;
}

export interface PortfolioExpenseMonthlyInputs {
  expenses: Expense[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioExpenseMonthly(
  inputs: PortfolioExpenseMonthlyInputs,
): {
  rollup: PortfolioExpenseMonthlyRollup;
  rows: PortfolioExpenseMonthlyRow[];
} {
  type Acc = {
    month: string;
    count: number;
    totalCents: number;
    reimbursedCents: number;
    byCategory: Map<ExpenseCategory, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalReceipts = 0;
  let totalCents = 0;
  let reimbursedCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        count: 0,
        totalCents: 0,
        reimbursedCents: 0,
        byCategory: new Map(),
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.count += 1;
    a.totalCents += e.amountCents;
    if (e.reimbursed) a.reimbursedCents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    a.byCategory.set(cat, (a.byCategory.get(cat) ?? 0) + 1);
    a.employees.add(e.employeeName);
    if (e.jobId) a.jobs.add(e.jobId);

    totalReceipts += 1;
    totalCents += e.amountCents;
    if (e.reimbursed) reimbursedCents += e.amountCents;
  }

  const rows: PortfolioExpenseMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCategory: Partial<Record<ExpenseCategory, number>> = {};
      for (const [k, v] of a.byCategory) byCategory[k] = v;
      return {
        month: a.month,
        count: a.count,
        totalCents: a.totalCents,
        reimbursedCents: a.reimbursedCents,
        byCategory,
        distinctEmployees: a.employees.size,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalReceipts,
      totalCents,
      reimbursedCents,
    },
    rows,
  };
}
