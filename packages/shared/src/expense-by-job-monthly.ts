// Per (job, month) employee expense rollup.
//
// Plain English: take expense-by-job and add the time axis.
// Per (jobId, yyyy-mm), how many receipts, total cents,
// category mix. Tells YGE the per-month rebill burden on each
// active job — small expenses pile up on long-running pursuits.
//
// Per row: jobId, month, total, totalCents, byCategory,
// distinctEmployees.
//
// Sort: jobId asc, month asc.
//
// Different from expense-by-job (per-job all-time),
// expense-by-category (portfolio kind mix),
// expense-by-employee (per-employee).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface ExpenseByJobMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  totalCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  distinctEmployees: number;
}

export interface ExpenseByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalReceipts: number;
  totalCents: number;
  unattributed: number;
}

export interface ExpenseByJobMonthlyInputs {
  expenses: Expense[];
  /** Optional yyyy-mm bounds inclusive applied to receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildExpenseByJobMonthly(
  inputs: ExpenseByJobMonthlyInputs,
): {
  rollup: ExpenseByJobMonthlyRollup;
  rows: ExpenseByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    cents: number;
    byCategory: Map<ExpenseCategory, number>;
    employees: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalReceipts = 0;
  let totalCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!e.jobId) {
      unattributed += 1;
      continue;
    }
    const key = `${e.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: e.jobId,
        month,
        total: 0,
        cents: 0,
        byCategory: new Map(),
        employees: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.cents += e.amountCents;
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    a.byCategory.set(cat, (a.byCategory.get(cat) ?? 0) + 1);
    a.employees.add(e.employeeName);

    jobs.add(e.jobId);
    months.add(month);
    totalReceipts += 1;
    totalCents += e.amountCents;
  }

  const rows: ExpenseByJobMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCategory: Partial<Record<ExpenseCategory, number>> = {};
      for (const [k, v] of a.byCategory) byCategory[k] = v;
      return {
        jobId: a.jobId,
        month: a.month,
        total: a.total,
        totalCents: a.cents,
        byCategory,
        distinctEmployees: a.employees.size,
      };
    })
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalReceipts,
      totalCents,
      unattributed,
    },
    rows,
  };
}
