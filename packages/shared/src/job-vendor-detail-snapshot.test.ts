import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildJobVendorDetailSnapshot } from './job-vendor-detail-snapshot';

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
    vendor: 'Home Depot',
    description: 'X',
    amountCents: 5_000_00,
    category: 'MATERIAL',
    jobId: 'j1',
    paidWithCompanyCard: false,
    reimbursed: false,
    ...over,
  } as Expense;
}

describe('buildJobVendorDetailSnapshot', () => {
  it('returns one row per vendor sorted by spend', () => {
    const r = buildJobVendorDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', vendor: 'Home Depot', amountCents: 5_000_00 })],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.vendorName).toBe('Granite');
    expect(r.rows[0]?.totalSpendCents).toBe(100_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobVendorDetailSnapshot({ jobId: 'X', apInvoices: [], expenses: [] });
    expect(r.rows.length).toBe(0);
  });
});
