// Portfolio employee expense year-over-year.
//
// Plain English: collapse two consecutive fiscal years of
// employee expense receipts into a single comparison row.
// Sized for the year-end "where are out-of-pocket dollars
// going?" review.
//
// Per row: prior + current count, totalCents, reimbursedCents
// + per-category mix + deltas.
//
// Different from expense-by-category-monthly (per month per
// category), expense-by-job (per job lifetime).
//
// Pure derivation. No persisted records.

import type { Expense, ExpenseCategory } from './expense';

export interface PortfolioExpenseYoyResult {
  priorYear: number;
  currentYear: number;
  priorCount: number;
  priorTotalCents: number;
  priorReimbursedCents: number;
  priorByCategory: Partial<Record<ExpenseCategory, number>>;
  currentCount: number;
  currentTotalCents: number;
  currentReimbursedCents: number;
  currentByCategory: Partial<Record<ExpenseCategory, number>>;
  countDelta: number;
  totalCentsDelta: number;
  reimbursedCentsDelta: number;
}

export interface PortfolioExpenseYoyInputs {
  expenses: Expense[];
  /** The current (later) year. Prior year is currentYear - 1. */
  currentYear: number;
}

export function buildPortfolioExpenseYoy(
  inputs: PortfolioExpenseYoyInputs,
): PortfolioExpenseYoyResult {
  const priorYear = inputs.currentYear - 1;

  let priorCount = 0;
  let priorTotalCents = 0;
  let priorReimb = 0;
  const priorByCategory = new Map<ExpenseCategory, number>();
  let currentCount = 0;
  let currentTotalCents = 0;
  let currentReimb = 0;
  const currentByCategory = new Map<ExpenseCategory, number>();

  for (const e of inputs.expenses) {
    const year = Number(e.receiptDate.slice(0, 4));
    const cat: ExpenseCategory = e.category ?? 'OTHER';
    if (year === priorYear) {
      priorCount += 1;
      priorTotalCents += e.amountCents;
      if (e.reimbursed) priorReimb += e.amountCents;
      priorByCategory.set(cat, (priorByCategory.get(cat) ?? 0) + e.amountCents);
    } else if (year === inputs.currentYear) {
      currentCount += 1;
      currentTotalCents += e.amountCents;
      if (e.reimbursed) currentReimb += e.amountCents;
      currentByCategory.set(cat, (currentByCategory.get(cat) ?? 0) + e.amountCents);
    }
  }

  function toRecord(m: Map<ExpenseCategory, number>): Partial<Record<ExpenseCategory, number>> {
    const out: Partial<Record<ExpenseCategory, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorCount,
    priorTotalCents,
    priorReimbursedCents: priorReimb,
    priorByCategory: toRecord(priorByCategory),
    currentCount,
    currentTotalCents,
    currentReimbursedCents: currentReimb,
    currentByCategory: toRecord(currentByCategory),
    countDelta: currentCount - priorCount,
    totalCentsDelta: currentTotalCents - priorTotalCents,
    reimbursedCentsDelta: currentReimb - priorReimb,
  };
}
