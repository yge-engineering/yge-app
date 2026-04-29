// Per (category, month) employee expense rollup.
//
// Plain English: bucket employee expense receipts by
// (ExpenseCategory, yyyy-mm of receiptDate). Tells YGE the
// monthly trend on each category — heavy civil per diem +
// fuel can run hot fast on long-distance jobs; this is the
// time-axis review the bookkeeper does each month.
//
// Per row: category, month, count, totalCents,
// reimbursedCents, distinctEmployees.
//
// Sort: month asc, totalCents desc within month.
//
// Different from expense-by-category (lifetime portfolio),
// expense-by-job-monthly (per-job axis),
// expense-by-employee (per-employee axis).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface ExpenseByCategoryMonthlyRow {
  category: ExpenseCategory;
  month: string;
  count: number;
  totalCents: number;
  reimbursedCents: number;
  distinctEmployees: number;
}

export interface ExpenseByCategoryMonthlyRollup {
  categoriesConsidered: number;
  monthsConsidered: number;
  totalReceipts: number;
  totalCents: number;
  reimbursedCents: number;
}

export interface ExpenseByCategoryMonthlyInputs {
  expenses: Expense[];
  /** Optional yyyy-mm bounds inclusive applied to receiptDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildExpenseByCategoryMonthly(
  inputs: ExpenseByCategoryMonthlyInputs,
): {
  rollup: ExpenseByCategoryMonthlyRollup;
  rows: ExpenseByCategoryMonthlyRow[];
} {
  type Acc = {
    category: ExpenseCategory;
    month: string;
    count: number;
    totalCents: number;
    reimbursedCents: number;
    employees: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const cats = new Set<ExpenseCategory>();
  const months = new Set<string>();

  let totalReceipts = 0;
  let totalCents = 0;
  let reimbursedCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const e of inputs.expenses) {
    const month = e.receiptDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const cat: ExpenseCategory = e.category ?? 'OTHER';
    const key = `${cat}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        category: cat,
        month,
        count: 0,
        totalCents: 0,
        reimbursedCents: 0,
        employees: new Set(),
      };
      accs.set(key, a);
    }
    a.count += 1;
    a.totalCents += e.amountCents;
    if (e.reimbursed) a.reimbursedCents += e.amountCents;
    a.employees.add(e.employeeName);

    cats.add(cat);
    months.add(month);
    totalReceipts += 1;
    totalCents += e.amountCents;
    if (e.reimbursed) reimbursedCents += e.amountCents;
  }

  const rows: ExpenseByCategoryMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      category: a.category,
      month: a.month,
      count: a.count,
      totalCents: a.totalCents,
      reimbursedCents: a.reimbursedCents,
      distinctEmployees: a.employees.size,
    }))
    .sort((x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return y.totalCents - x.totalCents;
    });

  return {
    rollup: {
      categoriesConsidered: cats.size,
      monthsConsidered: months.size,
      totalReceipts,
      totalCents,
      reimbursedCents,
    },
    rows,
  };
}
