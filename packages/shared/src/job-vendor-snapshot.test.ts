import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildJobVendorSnapshot } from './job-vendor-snapshot';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite Construction Co.',
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

describe('buildJobVendorSnapshot', () => {
  it('counts distinct vendors across AP + expenses', () => {
    const r = buildJobVendorSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite' })],
      expenses: [
        ex({ id: 'e1', vendor: 'Home Depot' }),
        ex({ id: 'e2', vendor: 'HOME DEPOT' }),
      ],
    });
    expect(r.apVendorCount).toBe(1);
    expect(r.expenseVendorCount).toBe(1);
    expect(r.distinctVendors).toBe(2);
  });

  it('sums spend across both rails', () => {
    const r = buildJobVendorSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', amountCents: 5_000_00 })],
    });
    expect(r.apBilledCents).toBe(100_000_00);
    expect(r.expenseReceiptCents).toBe(5_000_00);
    expect(r.totalSpendCents).toBe(105_000_00);
  });

  it('filters to one job', () => {
    const r = buildJobVendorSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', jobId: 'j1' }), ap({ id: 'b', jobId: 'j2' })],
      expenses: [ex({ id: 'c', jobId: 'j1' }), ex({ id: 'd', jobId: 'j2' })],
    });
    expect(r.apVendorCount).toBe(1);
    expect(r.expenseVendorCount).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildJobVendorSnapshot({ jobId: 'j1', apInvoices: [], expenses: [] });
    expect(r.distinctVendors).toBe(0);
  });
});
