import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildExpenseByCategoryMonthly } from './expense-by-category-monthly';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'ex-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    amountCents: 50_00,
    category: 'FUEL',
    description: 'Test',
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildExpenseByCategoryMonthly', () => {
  it('groups by (category, month)', () => {
    const r = buildExpenseByCategoryMonthly({
      expenses: [
        exp({ id: 'a', category: 'FUEL', receiptDate: '2026-04-15' }),
        exp({ id: 'b', category: 'MEAL', receiptDate: '2026-04-15' }),
        exp({ id: 'c', category: 'FUEL', receiptDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents per (category, month)', () => {
    const r = buildExpenseByCategoryMonthly({
      expenses: [
        exp({ id: 'a', amountCents: 30_00 }),
        exp({ id: 'b', amountCents: 70_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_00);
    expect(r.rows[0]?.count).toBe(2);
  });

  it('tracks reimbursed cents only when flagged', () => {
    const r = buildExpenseByCategoryMonthly({
      expenses: [
        exp({ id: 'a', amountCents: 50_00, reimbursed: true }),
        exp({ id: 'b', amountCents: 30_00, reimbursed: false }),
      ],
    });
    expect(r.rows[0]?.reimbursedCents).toBe(50_00);
    expect(r.rows[0]?.totalCents).toBe(80_00);
  });

  it('counts distinct employees', () => {
    const r = buildExpenseByCategoryMonthly({
      expenses: [
        exp({ id: 'a', employeeName: 'Pat' }),
        exp({ id: 'b', employeeName: 'Pat' }),
        exp({ id: 'c', employeeName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildExpenseByCategoryMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalReceipts).toBe(1);
  });

  it('sorts by month asc, totalCents desc within month', () => {
    const r = buildExpenseByCategoryMonthly({
      expenses: [
        exp({ id: 'a', category: 'FUEL', amountCents: 5_00, receiptDate: '2026-04-15' }),
        exp({ id: 'b', category: 'MEAL', amountCents: 100_00, receiptDate: '2026-04-15' }),
        exp({ id: 'c', category: 'FUEL', amountCents: 10_00, receiptDate: '2026-05-01' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.category).toBe('MEAL'); // bigger total in April
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildExpenseByCategoryMonthly({ expenses: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
