import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';

import { buildVendorSpendSnapshot } from './vendor-spend-snapshot';

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
    receiptDate: '2026-04-22',
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

describe('buildVendorSpendSnapshot', () => {
  it('sums AP billed + expense receipts', () => {
    const r = buildVendorSpendSnapshot({
      vendorName: 'Granite Construction',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite Construction Co.', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', vendor: 'GRANITE CONSTRUCTION INC', amountCents: 5_000_00 })],
    });
    expect(r.apBilledCents).toBe(100_000_00);
    expect(r.expenseReceiptCents).toBe(5_000_00);
    expect(r.totalSpendCents).toBe(105_000_00);
  });

  it('counts distinct jobs across both rails', () => {
    const r = buildVendorSpendSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' })],
      expenses: [ex({ id: 'b', vendor: 'Granite', jobId: 'j2' })],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('tracks last activity date across both rails', () => {
    const r = buildVendorSpendSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', invoiceDate: '2026-04-08' })],
      expenses: [ex({ id: 'b', vendor: 'Granite', receiptDate: '2026-04-22' })],
    });
    expect(r.lastActivityDate).toBe('2026-04-22');
  });

  it('handles unknown vendor', () => {
    const r = buildVendorSpendSnapshot({ vendorName: 'X', apInvoices: [], expenses: [] });
    expect(r.totalSpendCents).toBe(0);
  });
});
