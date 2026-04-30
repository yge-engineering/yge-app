import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Expense } from './expense';
import type { Job } from './job';

import { buildVendorCustomerYoy } from './vendor-customer-yoy';

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

describe('buildVendorCustomerYoy', () => {
  it('compares two years for one vendor', () => {
    const r = buildVendorCustomerYoy({
      vendorName: 'Granite',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE')],
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', jobId: 'j1', totalCents: 50_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', jobId: 'j1', totalCents: 100_000_00 }),
      ],
      expenses: [
        ex({ id: 'c', receiptDate: '2026-04-15', jobId: 'j2', amountCents: 5_000_00 }),
      ],
    });
    expect(r.priorDistinctCustomers).toBe(1);
    expect(r.currentDistinctCustomers).toBe(2);
    expect(r.totalSpendDelta).toBe(55_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorCustomerYoy({
      vendorName: 'X',
      currentYear: 2026,
      jobs: [],
      apInvoices: [],
      expenses: [],
    });
    expect(r.priorDistinctCustomers).toBe(0);
  });
});
