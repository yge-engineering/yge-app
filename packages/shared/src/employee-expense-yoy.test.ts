import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildEmployeeExpenseYoy } from './employee-expense-yoy';

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

describe('buildEmployeeExpenseYoy', () => {
  it('compares two years for one employee', () => {
    const r = buildEmployeeExpenseYoy({
      employeeId: 'e1',
      currentYear: 2026,
      expenses: [
        ex({ id: 'a', receiptDate: '2025-04-15', amountCents: 30_00 }),
        ex({ id: 'b', receiptDate: '2026-04-15', amountCents: 50_00 }),
      ],
    });
    expect(r.priorReceipts).toBe(1);
    expect(r.currentReceipts).toBe(1);
    expect(r.centsDelta).toBe(20_00);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeExpenseYoy({
      employeeId: 'X',
      currentYear: 2026,
      expenses: [],
    });
    expect(r.priorReceipts).toBe(0);
  });
});
