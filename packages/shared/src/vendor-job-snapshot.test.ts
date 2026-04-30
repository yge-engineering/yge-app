import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildVendorJobSnapshot } from './vendor-job-snapshot';

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

describe('buildVendorJobSnapshot', () => {
  it('counts distinct jobs across both rails', () => {
    const r = buildVendorJobSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Granite Construction Inc', jobId: 'j2' }),
      ],
      expenses: [
        ex({ id: 'c', vendor: 'GRANITE INC', jobId: 'j3' }),
      ],
    });
    expect(r.apJobCount).toBe(2);
    expect(r.expenseJobCount).toBe(1);
    expect(r.distinctJobs).toBe(3);
  });

  it('sums spend per rail', () => {
    const r = buildVendorJobSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', vendor: 'Granite', amountCents: 5_000_00 })],
    });
    expect(r.apBilledCents).toBe(100_000_00);
    expect(r.expenseReceiptCents).toBe(5_000_00);
    expect(r.totalSpendCents).toBe(105_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorJobSnapshot({ vendorName: 'X', apInvoices: [], expenses: [] });
    expect(r.distinctJobs).toBe(0);
  });
});
