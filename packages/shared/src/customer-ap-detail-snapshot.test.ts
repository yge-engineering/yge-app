import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Job } from './job';

import { buildCustomerApDetailSnapshot } from './customer-ap-detail-snapshot';

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

describe('buildCustomerApDetailSnapshot', () => {
  it('returns one row per job sorted by billed', () => {
    const r = buildCustomerApDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', vendorName: 'Granite', totalCents: 100_000_00, paidCents: 50_000_00 }),
        ap({ id: 'b', jobId: 'j1', vendorName: 'GRANITE LLC', totalCents: 25_000_00, paidCents: 25_000_00 }),
        ap({ id: 'c', jobId: 'j2', vendorName: 'Other', totalCents: 50_000_00, paidCents: 0 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.invoiceCount).toBe(2);
    expect(r.rows[0]?.distinctVendors).toBe(1);
    expect(r.rows[0]?.billedCents).toBe(125_000_00);
    expect(r.rows[0]?.paidCents).toBe(75_000_00);
    expect(r.rows[0]?.outstandingCents).toBe(50_000_00);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.outstandingCents).toBe(50_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerApDetailSnapshot({
      customerName: 'X',
      jobs: [],
      apInvoices: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
