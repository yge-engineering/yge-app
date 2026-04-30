import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorExpenseSnapshot } from './vendor-expense-snapshot';

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

describe('buildVendorExpenseSnapshot', () => {
  it('matches via canonicalized vendor name', () => {
    const r = buildVendorExpenseSnapshot({
      vendorName: 'Home Depot',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', vendor: 'Home Depot' }),
        ex({ id: 'b', vendor: 'HOME DEPOT' }),
        ex({ id: 'c', vendor: 'Lowes' }),
      ],
    });
    expect(r.totalReceipts).toBe(2);
  });

  it('breaks down by category + tracks last date', () => {
    const r = buildVendorExpenseSnapshot({
      vendorName: 'Home Depot',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', category: 'MATERIAL', receiptDate: '2026-04-08' }),
        ex({ id: 'b', category: 'TOOL_PURCHASE', receiptDate: '2026-04-22' }),
      ],
    });
    expect(r.byCategory.MATERIAL).toBe(1);
    expect(r.byCategory.TOOL_PURCHASE).toBe(1);
    expect(r.lastReceiptDate).toBe('2026-04-22');
  });

  it('handles unknown vendor', () => {
    const r = buildVendorExpenseSnapshot({ vendorName: 'X', expenses: [] });
    expect(r.totalReceipts).toBe(0);
  });
});
