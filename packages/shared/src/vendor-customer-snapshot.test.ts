import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildVendorCustomerSnapshot } from './vendor-customer-snapshot';

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

describe('buildVendorCustomerSnapshot', () => {
  it('counts distinct customers by job-owner', () => {
    const r = buildVendorCustomerSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'j1', ownerAgency: 'Caltrans' }),
        jb({ id: 'j2', ownerAgency: 'CAL FIRE' }),
        jb({ id: 'j3', ownerAgency: 'Tehama County' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Granite', jobId: 'j2' }),
      ],
      expenses: [
        ex({ id: 'c', vendor: 'Granite', jobId: 'j3' }),
      ],
    });
    expect(r.distinctCustomers).toBe(3);
    expect(r.distinctJobs).toBe(3);
  });

  it('sums spend per rail', () => {
    const r = buildVendorCustomerSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      apInvoices: [ap({ id: 'a', vendorName: 'Granite', totalCents: 100_000_00 })],
      expenses: [ex({ id: 'b', vendor: 'Granite', amountCents: 5_000_00 })],
    });
    expect(r.totalSpendCents).toBe(105_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorCustomerSnapshot({
      vendorName: 'X',
      jobs: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.distinctCustomers).toBe(0);
  });
});
