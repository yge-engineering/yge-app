import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildJobVendorYoy } from './job-vendor-yoy';

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

describe('buildJobVendorYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobVendorYoy({
      jobId: 'j1',
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', vendorName: 'Granite', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', vendorName: 'Granite', totalCents: 100_000_00 }),
      ],
      expenses: [
        ex({ id: 'c', receiptDate: '2026-04-15', vendor: 'Home Depot', amountCents: 5_000_00 }),
      ],
    });
    expect(r.priorDistinctVendors).toBe(1);
    expect(r.currentDistinctVendors).toBe(2);
    expect(r.priorTotalSpendCents).toBe(50_000_00);
    expect(r.currentTotalSpendCents).toBe(105_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobVendorYoy({
      jobId: 'X',
      currentYear: 2026,
      apInvoices: [],
      expenses: [],
    });
    expect(r.priorDistinctVendors).toBe(0);
  });
});
