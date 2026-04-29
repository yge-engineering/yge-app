// Expense reimbursement by employee.
//
// Plain English: roll the per-employee expense log up by
// employeeId — total spend, reimbursed mix, by-category mix,
// last receipt date. Useful for the "who has the most pending
// reimbursement" review and the "is anyone abusing the system"
// audit.
//
// Per row: employeeId, employeeName, total, totalCents,
// reimbursedCount, reimbursedCents, pendingCount,
// pendingCents, byCategory, lastReceiptDate.
//
// Sort by pendingCents desc.
//
// Different from expense-by-category (per category),
// reimbursement-summary (combined expense + mileage per
// employee).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface ExpenseByEmployeeRow {
  employeeId: string;
  employeeName: string;
  total: number;
  totalCents: number;
  reimbursedCount: number;
  reimbursedCents: number;
  pendingCount: number;
  pendingCents: number;
  byCategory: Partial<Record<ExpenseCategory, number>>;
  lastReceiptDate: string | null;
}

export interface ExpenseByEmployeeRollup {
  employeesConsidered: number;
  totalCount: number;
  totalCents: number;
  pendingCents: number;
}

export interface ExpenseByEmployeeInputs {
  expenses: Expense[];
  /** Optional yyyy-mm-dd window applied to receiptDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildExpenseByEmployee(
  inputs: ExpenseByEmployeeInputs,
): {
  rollup: ExpenseByEmployeeRollup;
  rows: ExpenseByEmployeeRow[];
} {
  type Acc = {
    employeeId: string;
    employeeName: string;
    total: number;
    totalCents: number;
    reimbursedCount: number;
    reimbursedCents: number;
    pendingCount: number;
    pendingCents: number;
    cats: Map<ExpenseCategory, number>;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let portfolioCount = 0;
  let portfolioCents = 0;
  let portfolioPendingCents = 0;

  for (const e of inputs.expenses) {
    if (inputs.fromDate && e.receiptDate < inputs.fromDate) continue;
    if (inputs.toDate && e.receiptDate > inputs.toDate) continue;
    portfolioCount += 1;
    portfolioCents += e.amountCents;
    if (!e.reimbursed) portfolioPendingCents += e.amountCents;
    const acc = accs.get(e.employeeId) ?? {
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      total: 0,
      totalCents: 0,
      reimbursedCount: 0,
      reimbursedCents: 0,
      pendingCount: 0,
      pendingCents: 0,
      cats: new Map<ExpenseCategory, number>(),
      lastDate: null,
    };
    acc.total += 1;
    acc.totalCents += e.amountCents;
    if (e.reimbursed) {
      acc.reimbursedCount += 1;
      acc.reimbursedCents += e.amountCents;
    } else {
      acc.pendingCount += 1;
      acc.pendingCents += e.amountCents;
    }
    acc.cats.set(e.category, (acc.cats.get(e.category) ?? 0) + 1);
    if (!acc.lastDate || e.receiptDate > acc.lastDate) acc.lastDate = e.receiptDate;
    accs.set(e.employeeId, acc);
  }

  const rows: ExpenseByEmployeeRow[] = [];
  for (const acc of accs.values()) {
    const obj: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of acc.cats.entries()) obj[k] = v;
    rows.push({
      employeeId: acc.employeeId,
      employeeName: acc.employeeName,
      total: acc.total,
      totalCents: acc.totalCents,
      reimbursedCount: acc.reimbursedCount,
      reimbursedCents: acc.reimbursedCents,
      pendingCount: acc.pendingCount,
      pendingCents: acc.pendingCents,
      byCategory: obj,
      lastReceiptDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => b.pendingCents - a.pendingCents);

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalCount: portfolioCount,
      totalCents: portfolioCents,
      pendingCents: portfolioPendingCents,
    },
    rows,
  };
}
