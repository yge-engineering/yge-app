import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildVendorJobYoy } from './vendor-job-yoy';

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

describe('buildVendorJobYoy', () => {
  it('compares two years for one vendor', () => {
    const r = buildVendorJobYoy({
      vendorName: 'Granite',
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', jobId: 'j1', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', jobId: 'j2', totalCents: 100_000_00 }),
      ],
      expenses: [
        ex({ id: 'c', receiptDate: '2026-04-15', jobId: 'j3', amountCents: 5_000_00 }),
      ],
    });
    expect(r.priorDistinctJobs).toBe(1);
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.totalSpendDelta).toBe(55_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorJobYoy({
      vendorName: 'X',
      currentYear: 2026,
      apInvoices: [],
      expenses: [],
    });
    expect(r.priorDistinctJobs).toBe(0);
  });
});
