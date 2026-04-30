import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildEmployeeVendorDetailSnapshot } from './employee-vendor-detail-snapshot';

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

describe('buildEmployeeVendorDetailSnapshot', () => {
  it('returns one row per vendor sorted by spend', () => {
    const r = buildEmployeeVendorDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', vendor: 'Home Depot', amountCents: 50_00 }),
        ex({ id: 'b', vendor: 'HOME DEPOT', amountCents: 50_00 }),
        ex({ id: 'c', vendor: 'Lowes', amountCents: 200_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.vendorName).toBe('Lowes');
    expect(r.rows[1]?.receipts).toBe(2);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeVendorDetailSnapshot({ employeeId: 'X', expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
