import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildEmployeeExpenseSnapshot } from './employee-expense-snapshot';

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

describe('buildEmployeeExpenseSnapshot', () => {
  it('filters to one employee', () => {
    const r = buildEmployeeExpenseSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', employeeId: 'e1' }),
        ex({ id: 'b', employeeId: 'e2' }),
      ],
    });
    expect(r.totalReceipts).toBe(1);
  });

  it('separates pending vs reimbursed (out-of-pocket only)', () => {
    const r = buildEmployeeExpenseSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', amountCents: 100_00, paidWithCompanyCard: false, reimbursed: false }),
        ex({ id: 'b', amountCents: 50_00, paidWithCompanyCard: false, reimbursed: true }),
        ex({ id: 'c', amountCents: 80_00, paidWithCompanyCard: true, reimbursed: false }),
      ],
    });
    expect(r.pendingReimbursementCents).toBe(100_00);
    expect(r.reimbursedCents).toBe(50_00);
  });

  it('counts distinct vendors normalized', () => {
    const r = buildEmployeeExpenseSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', vendor: 'Home Depot' }),
        ex({ id: 'b', vendor: 'HOME DEPOT' }),
        ex({ id: 'c', vendor: 'Lowes' }),
      ],
    });
    expect(r.distinctVendors).toBe(2);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeExpenseSnapshot({ employeeId: 'X', expenses: [] });
    expect(r.totalReceipts).toBe(0);
  });
});
