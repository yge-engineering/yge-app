import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildCustomerArDetailSnapshot } from './customer-ar-detail-snapshot';

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

describe('buildCustomerArDetailSnapshot', () => {
  it('returns one row per job sorted by outstanding', () => {
    const r = buildCustomerArDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', totalCents: 100_000_00, paidCents: 25_000_00 }),
        ar({ id: 'b', jobId: 'j1', totalCents: 50_000_00, paidCents: 50_000_00, status: 'PAID' }),
        ar({ id: 'c', jobId: 'j2', totalCents: 80_000_00, paidCents: 0, status: 'DISPUTED' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j2');
    expect(r.rows[0]?.outstandingCents).toBe(80_000_00);
    expect(r.rows[0]?.disputed).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j1');
    expect(r.rows[1]?.invoiceCount).toBe(2);
    expect(r.rows[1]?.billedCents).toBe(150_000_00);
    expect(r.rows[1]?.paidCents).toBe(75_000_00);
    expect(r.rows[1]?.outstandingCents).toBe(75_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerArDetailSnapshot({
      customerName: 'X',
      jobs: [],
      arInvoices: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
