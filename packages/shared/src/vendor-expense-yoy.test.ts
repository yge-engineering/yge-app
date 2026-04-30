import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorExpenseYoy } from './vendor-expense-yoy';

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

describe('buildVendorExpenseYoy', () => {
  it('compares two years for one vendor', () => {
    const r = buildVendorExpenseYoy({
      vendorName: 'Home Depot',
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

  it('handles unknown vendor', () => {
    const r = buildVendorExpenseYoy({ vendorName: 'X', currentYear: 2026, expenses: [] });
    expect(r.priorReceipts).toBe(0);
  });
});
