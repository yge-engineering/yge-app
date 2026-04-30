import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildEmployeeExpenseDetailSnapshot } from './employee-expense-detail-snapshot';

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

describe('buildEmployeeExpenseDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildEmployeeExpenseDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', employeeId: 'e1', jobId: 'j1', vendor: 'Home Depot', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: true }),
        ex({ id: 'b', employeeId: 'e1', jobId: 'j1', vendor: 'Home Depot LLC', amountCents: 50_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'c', employeeId: 'e1', jobId: 'j1', vendor: 'Lowe\'s', amountCents: 25_00, paidWithCompanyCard: true }),
        ex({ id: 'd', employeeId: 'e1', jobId: 'j2', vendor: 'Home Depot', amountCents: 200_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'e', employeeId: 'e2', jobId: 'j1', vendor: 'X', amountCents: 999_99 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j2');
    expect(r.rows[0]?.totalCents).toBe(200_00);
    expect(r.rows[0]?.pendingCents).toBe(200_00);
    expect(r.rows[1]?.jobId).toBe('j1');
    expect(r.rows[1]?.receiptCount).toBe(3);
    expect(r.rows[1]?.totalCents).toBe(175_00);
    expect(r.rows[1]?.distinctVendors).toBe(2);
    expect(r.rows[1]?.oopReceipts).toBe(2);
    expect(r.rows[1]?.oopCents).toBe(150_00);
    expect(r.rows[1]?.reimbursedCents).toBe(100_00);
    expect(r.rows[1]?.pendingCents).toBe(50_00);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeExpenseDetailSnapshot({ employeeId: 'X', expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
