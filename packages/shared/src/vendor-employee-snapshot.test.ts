import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorEmployeeSnapshot } from './vendor-employee-snapshot';

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

describe('buildVendorEmployeeSnapshot', () => {
  it('counts distinct employees + top-N', () => {
    const r = buildVendorEmployeeSnapshot({
      vendorName: 'Home Depot',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', employeeId: 'e1', employeeName: 'Pat' }),
        ex({ id: 'b', employeeId: 'e1', employeeName: 'Pat' }),
        ex({ id: 'c', employeeId: 'e2', employeeName: 'Sam' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.totalReceipts).toBe(3);
    expect(r.topEmployees[0]?.employeeId).toBe('e1');
    expect(r.topEmployees[0]?.receipts).toBe(2);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorEmployeeSnapshot({ vendorName: 'X', expenses: [] });
    expect(r.distinctEmployees).toBe(0);
  });
});
