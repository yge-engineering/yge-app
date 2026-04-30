import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildJobExpenseSnapshot } from './job-expense-snapshot';

function ex(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    vendor: 'Home Depot',
    description: 'Concrete patch',
    amountCents: 50_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildJobExpenseSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobExpenseSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', jobId: 'j1' }),
        ex({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalReceipts).toBe(1);
  });

  it('separates pending vs reimbursed (out-of-pocket only)', () => {
    const r = buildJobExpenseSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'b', amountCents: 50_00, paidWithCompanyCard: false, reimbursed: true }),
        ex({ id: 'c', amountCents: 80_00, paidWithCompanyCard: true, reimbursed: false }),
      ],
    });
    expect(r.pendingReimbursementCents).toBe(100_00);
    expect(r.reimbursedCents).toBe(50_00);
    expect(r.reimbursableCents).toBe(150_00);
  });

  it('breaks down by category', () => {
    const r = buildJobExpenseSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', category: 'MATERIAL' }),
        ex({ id: 'b', category: 'FUEL' }),
      ],
    });
    expect(r.byCategory.MATERIAL).toBe(1);
    expect(r.byCategory.FUEL).toBe(1);
  });

  it('tracks last receipt date', () => {
    const r = buildJobExpenseSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', receiptDate: '2026-04-08' }),
        ex({ id: 'b', receiptDate: '2026-04-22' }),
      ],
    });
    expect(r.lastReceiptDate).toBe('2026-04-22');
  });

  it('handles no matching expenses', () => {
    const r = buildJobExpenseSnapshot({ jobId: 'j1', expenses: [] });
    expect(r.totalReceipts).toBe(0);
    expect(r.lastReceiptDate).toBeNull();
  });
});
