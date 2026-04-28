import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildExpenseByCategory } from './expense-by-category';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeId: 'e1',
    employeeName: 'Joe',
    receiptDate: '2026-04-15',
    vendor: 'Diner',
    description: 'Lunch',
    amountCents: 25_00,
    category: 'MEAL',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildExpenseByCategory', () => {
  it('groups expenses by category', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'a', category: 'MEAL', amountCents: 30_00 }),
        exp({ id: 'b', category: 'MEAL', amountCents: 50_00 }),
        exp({ id: 'c', category: 'FUEL', amountCents: 80_00 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const meal = r.rows.find((x) => x.category === 'MEAL');
    expect(meal?.count).toBe(2);
    expect(meal?.totalCents).toBe(80_00);
  });

  it('computes avgCents per category', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'a', amountCents: 20_00 }),
        exp({ id: 'b', amountCents: 60_00 }),
      ],
    });
    expect(r.rows[0]?.avgCents).toBe(40_00);
  });

  it('counts reimbursed separately', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'a', reimbursed: true, amountCents: 30_00 }),
        exp({ id: 'b', reimbursed: false, amountCents: 50_00 }),
      ],
    });
    expect(r.rows[0]?.reimbursedCount).toBe(1);
    expect(r.rows[0]?.reimbursedCents).toBe(30_00);
  });

  it('counts distinct employees per category', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'a', employeeId: 'e1' }),
        exp({ id: 'b', employeeId: 'e1' }),
        exp({ id: 'c', employeeId: 'e2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('computes share of portfolio', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'a', category: 'MEAL', amountCents: 60_00 }),
        exp({ id: 'b', category: 'FUEL', amountCents: 40_00 }),
      ],
    });
    const meal = r.rows.find((x) => x.category === 'MEAL');
    expect(meal?.share).toBeCloseTo(0.6, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildExpenseByCategory({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildExpenseByCategory({
      expenses: [
        exp({ id: 'small', category: 'PARKING', amountCents: 5_00 }),
        exp({ id: 'big', category: 'LODGING', amountCents: 200_00 }),
      ],
    });
    expect(r.rows[0]?.category).toBe('LODGING');
  });

  it('handles empty input', () => {
    const r = buildExpenseByCategory({ expenses: [] });
    expect(r.rows).toHaveLength(0);
  });
});
