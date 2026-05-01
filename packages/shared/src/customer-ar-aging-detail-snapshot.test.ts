import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildCustomerArAgingDetailSnapshot } from './customer-ar-aging-detail-snapshot';

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

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerArAgingDetailSnapshot', () => {
  it('buckets unpaid invoices by age', () => {
    const r = buildCustomerArAgingDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-20', totalCents: 50_000_00, paidCents: 0 }),  // 10d
        ar({ id: 'b', jobId: 'j1', invoiceDate: '2026-03-15', totalCents: 25_000_00, paidCents: 0 }),  // 46d
        ar({ id: 'c', jobId: 'j1', invoiceDate: '2026-02-01', totalCents: 10_000_00, paidCents: 0 }),  // 88d
        ar({ id: 'd', jobId: 'j1', invoiceDate: '2025-12-01', totalCents: 5_000_00, paidCents: 0 }),   // 150d
        ar({ id: 'e', jobId: 'j1', invoiceDate: '2026-04-01', totalCents: 5_000_00, paidCents: 5_000_00, status: 'PAID' }), // excluded
        ar({ id: 'f', jobId: 'j2', invoiceDate: '2026-04-25', totalCents: 30_000_00, paidCents: 0 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.bucket0to30Cents).toBe(50_000_00);
    expect(r.rows[0]?.bucket31to60Cents).toBe(25_000_00);
    expect(r.rows[0]?.bucket61to90Cents).toBe(10_000_00);
    expect(r.rows[0]?.bucket91plusCents).toBe(5_000_00);
    expect(r.rows[0]?.totalOutstandingCents).toBe(90_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(4);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.bucket0to30Cents).toBe(30_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerArAgingDetailSnapshot({ customerName: 'X', jobs: [], arInvoices: [] });
    expect(r.rows.length).toBe(0);
  });
});
