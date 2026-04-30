import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorEmployeeYoy } from './vendor-employee-yoy';

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

describe('buildVendorEmployeeYoy', () => {
  it('compares two years for one vendor', () => {
    const r = buildVendorEmployeeYoy({
      vendorName: 'Home Depot',
      currentYear: 2026,
      expenses: [
        ex({ id: 'a', employeeId: 'e1', receiptDate: '2025-04-15' }),
        ex({ id: 'b', employeeId: 'e2', receiptDate: '2026-04-15' }),
        ex({ id: 'c', employeeId: 'e3', receiptDate: '2026-04-22' }),
      ],
    });
    expect(r.priorDistinctEmployees).toBe(1);
    expect(r.currentDistinctEmployees).toBe(2);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorEmployeeYoy({ vendorName: 'X', currentYear: 2026, expenses: [] });
    expect(r.priorReceipts).toBe(0);
  });
});
