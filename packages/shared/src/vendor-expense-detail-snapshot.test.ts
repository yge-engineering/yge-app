import { describe, expect, it } from 'vitest';

import type { Expense } from './expense';

import { buildVendorExpenseDetailSnapshot } from './vendor-expense-detail-snapshot';

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

describe('buildVendorExpenseDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildVendorExpenseDetailSnapshot({
      vendorName: 'Home Depot',
      asOf: '2026-04-30',
      expenses: [
        ex({ id: 'a', vendor: 'Home Depot', jobId: 'j1', employeeId: 'e1', amountCents: 100_00 }),
        ex({ id: 'b', vendor: 'HOME DEPOT INC', jobId: 'j1', employeeId: 'e2', amountCents: 50_00 }),
        ex({ id: 'c', vendor: 'home depot llc', jobId: 'j2', employeeId: 'e1', amountCents: 25_00 }),
        ex({ id: 'd', vendor: 'Lowe\'s', jobId: 'j1', employeeId: 'e1', amountCents: 999_99 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.receiptCount).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(150_00);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.totalCents).toBe(25_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorExpenseDetailSnapshot({ vendorName: 'X', expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
