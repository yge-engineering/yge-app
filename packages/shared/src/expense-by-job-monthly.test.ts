import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildExpenseByJobMonthly } from './expense-by-job-monthly';

function exp(over: Partial<Expense>): Expense {
  return {
    id: 'ex-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    amountCents: 50_00,
    category: 'FUEL',
    jobId: 'j1',
    description: 'Fuel run',
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildExpenseByJobMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', jobId: 'j1', receiptDate: '2026-04-15' }),
        exp({ id: 'b', jobId: 'j1', receiptDate: '2026-05-01' }),
        exp({ id: 'c', jobId: 'j2', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents and counts receipts per (job, month)', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', amountCents: 30_00 }),
        exp({ id: 'b', amountCents: 70_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_00);
    expect(r.rows[0]?.total).toBe(2);
  });

  it('breaks down by category', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', category: 'FUEL' }),
        exp({ id: 'b', category: 'MEAL' }),
        exp({ id: 'c', category: 'FUEL' }),
      ],
    });
    expect(r.rows[0]?.byCategory.FUEL).toBe(2);
    expect(r.rows[0]?.byCategory.MEAL).toBe(1);
  });

  it('counts distinct employees', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', employeeName: 'Pat' }),
        exp({ id: 'b', employeeName: 'Pat' }),
        exp({ id: 'c', employeeName: 'Sam' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('counts unattributed receipts (no jobId)', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', jobId: 'j1' }),
        exp({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth window', () => {
    const r = buildExpenseByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      expenses: [
        exp({ id: 'old', receiptDate: '2026-03-15' }),
        exp({ id: 'in', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalReceipts).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildExpenseByJobMonthly({
      expenses: [
        exp({ id: 'a', jobId: 'Z', receiptDate: '2026-04-15' }),
        exp({ id: 'b', jobId: 'A', receiptDate: '2026-05-01' }),
        exp({ id: 'c', jobId: 'A', receiptDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildExpenseByJobMonthly({ expenses: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalReceipts).toBe(0);
  });
});
