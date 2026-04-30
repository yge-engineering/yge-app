import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildVendorCustomerDetailSnapshot } from './vendor-customer-detail-snapshot';

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

describe('buildVendorCustomerDetailSnapshot', () => {
  it('returns one row per customer sorted by spend', () => {
    const r = buildVendorCustomerDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE')],
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', totalCents: 100_000_00 }),
        ap({ id: 'b', jobId: 'j2', totalCents: 25_000_00 }),
      ],
      expenses: [
        ex({ id: 'c', jobId: 'j1', amountCents: 5_000_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.customerName).toBe('Caltrans');
    expect(r.rows[0]?.totalSpendCents).toBe(105_000_00);
    expect(r.rows[0]?.distinctJobs).toBe(1);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorCustomerDetailSnapshot({
      vendorName: 'X',
      jobs: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
