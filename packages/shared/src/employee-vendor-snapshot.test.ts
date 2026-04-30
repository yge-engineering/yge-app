import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildEmployeeVendorSnapshot } from './employee-vendor-snapshot';

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

describe('buildEmployeeVendorSnapshot', () => {
  it('counts distinct vendors + top-N', () => {
    const r = buildEmployeeVendorSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', vendor: 'Home Depot' }),
        ex({ id: 'b', vendor: 'HOME DEPOT' }),
        ex({ id: 'c', vendor: 'Lowes' }),
      ],
    });
    expect(r.distinctVendors).toBe(2);
    expect(r.topVendors[0]?.receipts).toBe(2);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeVendorSnapshot({ employeeId: 'X', expenses: [] });
    expect(r.distinctVendors).toBe(0);
  });
});
