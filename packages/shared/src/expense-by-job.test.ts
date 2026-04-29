import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildExpenseByJob } from './expense-by-job';

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
    jobId: 'j1',
    ...over,
  } as Expense;
}

describe('buildExpenseByJob', () => {
  it('groups by jobId', () => {
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', jobId: 'j1' }),
        exp({ id: 'b', jobId: 'j2' }),
        exp({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums cents and counts distinct employees', () => {
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', employeeId: 'e1', amountCents: 30_00 }),
        exp({ id: 'b', employeeId: 'e2', amountCents: 50_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(80_00);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('breaks down by category', () => {
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', category: 'MEAL' }),
        exp({ id: 'b', category: 'FUEL' }),
      ],
    });
    expect(r.rows[0]?.byCategory.MEAL).toBe(1);
    expect(r.rows[0]?.byCategory.FUEL).toBe(1);
  });

  it('counts unattributed', () => {
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', jobId: 'j1' }),
        exp({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('tracks last receipt date', () => {
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', receiptDate: '2026-04-10' }),
        exp({ id: 'b', receiptDate: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastReceiptDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate', () => {
    const r = buildExpenseByJob({
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
    const r = buildExpenseByJob({
      expenses: [
        exp({ id: 'a', jobId: 'small', amountCents: 5_00 }),
        exp({ id: 'b', jobId: 'big', amountCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildExpenseByJob({ expenses: [] });
    expect(r.rows).toHaveLength(0);
  });
});
