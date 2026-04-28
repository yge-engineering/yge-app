// Expense reimbursement by category.
//
// Plain English: roll the per-employee expense log up by
// ExpenseCategory (MEAL, PER_DIEM, LODGING, FUEL, PARKING,
// TOLLS, MATERIAL, TOOL_PURCHASE, PERMIT_FEE, TRAINING_FEE,
// AGENCY_FEE, OFFICE_SUPPLIES, OTHER). Heavy civil per diem +
// fuel can run hot fast on long-distance jobs; this is the
// monthly review check.
//
// Per row: category, count, totalCents, avgCents,
// reimbursedCount, reimbursedCents, distinctEmployees, share.
//
// Sort by totalCents desc.
//
// Different from reimbursement-summary (per-employee combined
// expense + mileage rollup), and the per-vendor / per-job
// modules.
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface ExpenseByCategoryRow {
  category: ExpenseCategory;
  count: number;
  totalCents: number;
  avgCents: number;
  reimbursedCount: number;
  reimbursedCents: number;
  distinctEmployees: number;
  share: number;
}

export interface ExpenseByCategoryRollup {
  categoriesConsidered: number;
  totalCount: number;
  totalCents: number;
  reimbursedCents: number;
}

export interface ExpenseByCategoryInputs {
  expenses: Expense[];
  /** Optional yyyy-mm-dd window applied to receiptDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildExpenseByCategory(
  inputs: ExpenseByCategoryInputs,
): {
  rollup: ExpenseByCategoryRollup;
  rows: ExpenseByCategoryRow[];
} {
  type Acc = {
    count: number;
    total: number;
    reimbursedCount: number;
    reimbursedTotal: number;
    employees: Set<string>;
  };
  const accs = new Map<ExpenseCategory, Acc>();
  let portfolioCount = 0;
  let portfolioTotal = 0;
  let portfolioReimbursed = 0;

  for (const e of inputs.expenses) {
    if (inputs.fromDate && e.receiptDate < inputs.fromDate) continue;
    if (inputs.toDate && e.receiptDate > inputs.toDate) continue;
    portfolioCount += 1;
    portfolioTotal += e.amountCents;
    if (e.reimbursed) portfolioReimbursed += e.amountCents;
    const acc = accs.get(e.category) ?? {
      count: 0,
      total: 0,
      reimbursedCount: 0,
      reimbursedTotal: 0,
      employees: new Set<string>(),
    };
    acc.count += 1;
    acc.total += e.amountCents;
    if (e.reimbursed) {
      acc.reimbursedCount += 1;
      acc.reimbursedTotal += e.amountCents;
    }
    acc.employees.add(e.employeeId);
    accs.set(e.category, acc);
  }

  const rows: ExpenseByCategoryRow[] = [];
  for (const [category, acc] of accs.entries()) {
    const avg = acc.count === 0 ? 0 : Math.round(acc.total / acc.count);
    const share = portfolioTotal === 0
      ? 0
      : Math.round((acc.total / portfolioTotal) * 10_000) / 10_000;
    rows.push({
      category,
      count: acc.count,
      totalCents: acc.total,
      avgCents: avg,
      reimbursedCount: acc.reimbursedCount,
      reimbursedCents: acc.reimbursedTotal,
      distinctEmployees: acc.employees.size,
      share,
    });
  }

  rows.sort((a, b) => b.totalCents - a.totalCents);

  return {
    rollup: {
      categoriesConsidered: rows.length,
      totalCount: portfolioCount,
      totalCents: portfolioTotal,
      reimbursedCents: portfolioReimbursed,
    },
    rows,
  };
}
