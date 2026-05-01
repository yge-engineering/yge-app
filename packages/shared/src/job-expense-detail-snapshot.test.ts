import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildJobExpenseDetailSnapshot } from './job-expense-detail-snapshot';

function ex(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    vendor: 'Home Depot',
    description: 'X',
    amountCents: 50_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildJobExpenseDetailSnapshot', () => {
  it('returns one row per category sorted by total', () => {
    const r = buildJobExpenseDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', jobId: 'j1', employeeId: 'e1', vendor: 'Home Depot', category: 'MATERIAL', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: true }),
        ex({ id: 'b', jobId: 'j1', employeeId: 'e2', vendor: 'Home Depot LLC', category: 'MATERIAL', amountCents: 50_00, paidWithCompanyCard: true }),
        ex({ id: 'c', jobId: 'j1', employeeId: 'e1', vendor: 'Shell', category: 'FUEL', amountCents: 75_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'd', jobId: 'j2', vendor: 'X', amountCents: 999_99 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.category).toBe('MATERIAL');
    expect(r.rows[0]?.receiptCount).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(150_00);
    expect(r.rows[0]?.distinctVendors).toBe(1);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.oopCount).toBe(1);
    expect(r.rows[0]?.reimbursedCents).toBe(100_00);
    expect(r.rows[1]?.category).toBe('FUEL');
    expect(r.rows[1]?.pendingCents).toBe(75_00);
  });

  it('handles unknown job', () => {
    const r = buildJobExpenseDetailSnapshot({ jobId: 'X', expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
