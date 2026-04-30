import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerVendorDetailSnapshot } from './customer-vendor-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

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

describe('buildCustomerVendorDetailSnapshot', () => {
  it('returns one row per vendor sorted by total spend', () => {
    const r = buildCustomerVendorDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans')],
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', vendor: 'Home Depot', amountCents: 5_000_00 })],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.vendorName).toBe('Granite');
    expect(r.rows[0]?.totalSpendCents).toBe(100_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerVendorDetailSnapshot({
      customerName: 'X',
      jobs: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
