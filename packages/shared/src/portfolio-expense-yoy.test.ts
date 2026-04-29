import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildPortfolioExpenseYoy } from './portfolio-expense-yoy';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'ex-1',
    createdAt: '',
    updatedAt: '',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    amountCents: 50_00,
    category: 'FUEL',
    description: 'Test',
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildPortfolioExpenseYoy', () => {
  it('compares prior vs current year', () => {
    const r = buildPortfolioExpenseYoy({
      currentYear: 2026,
      expenses: [
        exp({ id: 'a', receiptDate: '2025-04-15', amountCents: 30_00 }),
        exp({ id: 'b', receiptDate: '2026-04-15', amountCents: 70_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(30_00);
    expect(r.currentTotalCents).toBe(70_00);
    expect(r.totalCentsDelta).toBe(40_00);
  });

  it('sums reimbursed only when flagged', () => {
    const r = buildPortfolioExpenseYoy({
      currentYear: 2026,
      expenses: [
        exp({ id: 'a', receiptDate: '2026-04-15', amountCents: 50_00, reimbursed: true }),
        exp({ id: 'b', receiptDate: '2026-04-16', amountCents: 30_00, reimbursed: false }),
      ],
    });
    expect(r.currentReimbursedCents).toBe(50_00);
  });

  it('breaks down by category', () => {
    const r = buildPortfolioExpenseYoy({
      currentYear: 2026,
      expenses: [
        exp({ id: 'a', receiptDate: '2026-04-15', category: 'FUEL', amountCents: 100_00 }),
        exp({ id: 'b', receiptDate: '2026-04-16', category: 'MEAL', amountCents: 50_00 }),
      ],
    });
    expect(r.currentByCategory.FUEL).toBe(100_00);
    expect(r.currentByCategory.MEAL).toBe(50_00);
  });

  it('ignores expenses outside the two-year window', () => {
    const r = buildPortfolioExpenseYoy({
      currentYear: 2026,
      expenses: [
        exp({ id: 'a', receiptDate: '2024-04-15', amountCents: 100_00 }),
        exp({ id: 'b', receiptDate: '2026-04-15', amountCents: 100_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(0);
    expect(r.currentTotalCents).toBe(100_00);
  });

  it('handles empty input', () => {
    const r = buildPortfolioExpenseYoy({ currentYear: 2026, expenses: [] });
    expect(r.priorCount).toBe(0);
    expect(r.currentCount).toBe(0);
  });
});
