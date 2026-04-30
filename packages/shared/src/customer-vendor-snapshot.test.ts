import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildCustomerVendorSnapshot } from './customer-vendor-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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

describe('buildCustomerVendorSnapshot', () => {
  it('joins via job.ownerAgency and counts vendors across both rails', () => {
    const r = buildCustomerVendorSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', vendorName: 'Granite' }),
        ap({ id: 'b', jobId: 'j2', vendorName: 'Olson' }),
      ],
      expenses: [
        ex({ id: 'c', jobId: 'j1', vendor: 'Home Depot' }),
      ],
    });
    expect(r.apVendorCount).toBe(1);
    expect(r.expenseVendorCount).toBe(1);
    expect(r.distinctVendors).toBe(2);
    expect(r.totalSpendCents).toBe(105_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerVendorSnapshot({
      customerName: 'X',
      jobs: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.distinctVendors).toBe(0);
  });
});
