import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildExpenseByEmployee } from './expense-by-employee';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeId: 'e1',
    employeeName: 'Joe',
    receiptDate: '2026-04-15',
    vendor: 'Test',
    description: 'Lunch',
    amountCents: 25_00,
    category: 'MEAL',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildExpenseByEmployee', () => {
  it('groups by employeeId', () => {
    const r = buildExpenseByEmployee({
      expenses: [
        exp({ id: 'a', employeeId: 'e1' }),
        exp({ id: 'b', employeeId: 'e1' }),
        exp({ id: 'c', employeeId: 'e2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('separates reimbursed from pending', () => {
    const r = buildExpenseByEmployee({
      expenses: [
        exp({ id: 'a', reimbursed: true, amountCents: 30_00 }),
        exp({ id: 'b', reimbursed: false, amountCents: 50_00 }),
      ],
    });
    expect(r.rows[0]?.reimbursedCount).toBe(1);
    expect(r.rows[0]?.pendingCount).toBe(1);
    expect(r.rows[0]?.reimbursedCents).toBe(30_00);
    expect(r.rows[0]?.pendingCents).toBe(50_00);
  });

  it('breaks down by category', () => {
    const r = buildExpenseByEmployee({
      expenses: [
        exp({ id: 'a', category: 'MEAL' }),
        exp({ id: 'b', category: 'FUEL' }),
        exp({ id: 'c', category: 'MEAL' }),
      ],
    });
    expect(r.rows[0]?.byCategory.MEAL).toBe(2);
    expect(r.rows[0]?.byCategory.FUEL).toBe(1);
  });

  it('tracks last receipt date', () => {
    const r = buildExpenseByEmployee({
      expenses: [
        exp({ id: 'a', receiptDate: '2026-04-10' }),
        exp({ id: 'b', receiptDate: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastReceiptDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildExpenseByEmployee({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(1);
  });

  it('sorts by pendingCents desc', () => {
    const r = buildExpenseByEmployee({
      expenses: [
        exp({ id: 'a', employeeId: 'small', amountCents: 5_00, reimbursed: false }),
        exp({ id: 'b', employeeId: 'big', amountCents: 50_00, reimbursed: false }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildExpenseByEmployee({ expenses: [] });
    expect(r.rows).toHaveLength(0);
  });
});
