import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorEmployeeDetailSnapshot } from './vendor-employee-detail-snapshot';

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

describe('buildVendorEmployeeDetailSnapshot', () => {
  it('returns one row per employee sorted by spend', () => {
    const r = buildVendorEmployeeDetailSnapshot({
      vendorName: 'Home Depot',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', employeeId: 'e1', employeeName: 'Pat', amountCents: 50_00 }),
        ex({ id: 'b', employeeId: 'e1', employeeName: 'Pat', amountCents: 50_00, receiptDate: '2026-04-22' }),
        ex({ id: 'c', employeeId: 'e2', employeeName: 'Sam', amountCents: 200_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.employeeId).toBe('e2');
    expect(r.rows[0]?.totalCents).toBe(200_00);
    expect(r.rows[1]?.employeeId).toBe('e1');
    expect(r.rows[1]?.lastReceiptDate).toBe('2026-04-22');
  });

  it('handles unknown vendor', () => {
    const r = buildVendorEmployeeDetailSnapshot({ vendorName: 'X', expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
