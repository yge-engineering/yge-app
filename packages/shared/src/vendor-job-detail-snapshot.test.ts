import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildVendorJobDetailSnapshot } from './vendor-job-detail-snapshot';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

function ex(over: Partial<Expense>): Expense {
  return {
    id: 'exp-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    employeeName: 'Pat',
    receiptDate: '2026-04-15',
    vendor: 'Granite',
    description: 'X',
    amountCents: 5_000_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildVendorJobDetailSnapshot', () => {
  it('returns one row per job with combined spend', () => {
    const r = buildVendorJobDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', totalCents: 100_000_00 }),
        ap({ id: 'b', jobId: 'j2', totalCents: 50_000_00 }),
      ],
      expenses: [
        ex({ id: 'c', jobId: 'j1', amountCents: 5_000_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.totalSpendCents).toBe(105_000_00);
    expect(r.rows[1]?.totalSpendCents).toBe(50_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorJobDetailSnapshot({
      vendorName: 'X',
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
