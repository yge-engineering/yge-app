import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { ArPayment } from './ar-payment';
import type { Job } from './job';

import { buildCustomerJobDetailSnapshot } from './customer-job-detail-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Project A',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'AWARDED',
    ownerAgency: 'Caltrans',
    ...over,
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
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 0,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'p1',
    createdAt: '',
    updatedAt: '',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-25',
    amountCents: 30_000_00,
    payerName: 'X',
    ...over,
  } as ArPayment;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildCustomerJobDetailSnapshot', () => {
  it('returns one row per customer-job with AR/AP rollup', () => {
    const r = buildCustomerJobDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [
        jb({ id: 'j1', projectName: 'Project A' }),
        jb({ id: 'j2', projectName: 'Project B', ownerAgency: 'Other' }),
      ],
      arInvoices: [ar({ id: 'ar-a', jobId: 'j1', totalCents: 100_000_00, retentionCents: 5_000_00 })],
      arPayments: [arp({ arInvoiceId: 'ar-a', jobId: 'j1', amountCents: 30_000_00 })],
      apInvoices: [ap({ id: 'ap-a', jobId: 'j1', totalCents: 50_000_00 })],
    });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]?.arBilledCents).toBe(100_000_00);
    expect(r.rows[0]?.arPaidCents).toBe(30_000_00);
    expect(r.rows[0]?.arOpenCents).toBe(70_000_00);
    expect(r.rows[0]?.arRetentionCents).toBe(5_000_00);
    expect(r.rows[0]?.apBilledCents).toBe(50_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerJobDetailSnapshot({
      customerName: 'X',
      jobs: [],
      arInvoices: [],
      arPayments: [],
      apInvoices: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
