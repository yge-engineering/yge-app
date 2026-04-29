import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildPortfolioExpenseMonthly } from './portfolio-expense-monthly';

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

describe('buildPortfolioExpenseMonthly', () => {
  it('breaks down by category', () => {
    const r = buildPortfolioExpenseMonthly({
      expenses: [
        exp({ id: 'a', category: 'FUEL' }),
        exp({ id: 'b', category: 'MEAL' }),
        exp({ id: 'c', category: 'FUEL' }),
      ],
    });
    expect(r.rows[0]?.byCategory.FUEL).toBe(2);
    expect(r.rows[0]?.byCategory.MEAL).toBe(1);
  });

  it('sums totalCents + reimbursedCents (only when flagged)', () => {
    const r = buildPortfolioExpenseMonthly({
      expenses: [
        exp({ id: 'a', amountCents: 50_00, reimbursed: true }),
        exp({ id: 'b', amountCents: 30_00, reimbursed: false }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(80_00);
    expect(r.rows[0]?.reimbursedCents).toBe(50_00);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioExpenseMonthly({
      expenses: [
        exp({ id: 'a', employeeName: 'Pat', jobId: 'j1' }),
        exp({ id: 'b', employeeName: 'Sam', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioExpenseMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalReceipts).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioExpenseMonthly({
      expenses: [
        exp({ id: 'a', receiptDate: '2026-06-15' }),
        exp({ id: 'b', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioExpenseMonthly({ expenses: [] });
    expect(r.rows).toHaveLength(0);
  });
});
