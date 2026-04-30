import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildPortfolioExpenseSnapshot } from './portfolio-expense-snapshot';

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

describe('buildPortfolioExpenseSnapshot', () => {
  it('counts receipts + sums cents + ytd', () => {
    const r = buildPortfolioExpenseSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      expenses: [
        ex({ id: 'a', receiptDate: '2025-04-15', amountCents: 100_00 }),
        ex({ id: 'b', receiptDate: '2026-04-15', amountCents: 50_00 }),
      ],
    });
    expect(r.totalReceipts).toBe(2);
    expect(r.totalCents).toBe(150_00);
    expect(r.ytdReceipts).toBe(1);
    expect(r.ytdCents).toBe(50_00);
  });

  it('breaks down by category', () => {
    const r = buildPortfolioExpenseSnapshot({
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', category: 'MATERIAL' }),
        ex({ id: 'b', category: 'FUEL' }),
        ex({ id: 'c', category: 'MATERIAL' }),
      ],
    });
    expect(r.byCategory.MATERIAL).toBe(2);
    expect(r.byCategory.FUEL).toBe(1);
  });

  it('separates pending vs reimbursed (out of pocket only)', () => {
    const r = buildPortfolioExpenseSnapshot({
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

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioExpenseSnapshot({
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        ex({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores receipts after asOf', () => {
    const r = buildPortfolioExpenseSnapshot({
      asOf: '2026-04-30',
      expenses: [ex({ id: 'late', receiptDate: '2026-05-15' })],
    });
    expect(r.totalReceipts).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioExpenseSnapshot({ expenses: [] });
    expect(r.totalReceipts).toBe(0);
  });
});
