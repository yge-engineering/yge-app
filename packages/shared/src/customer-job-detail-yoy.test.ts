import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildCustomerJobDetailYoy } from './customer-job-detail-yoy';

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

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'V',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 30_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildCustomerJobDetailYoy', () => {
  it('returns one row per job with AR + AP YoY', () => {
    const r = buildCustomerJobDetailYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb({ id: 'j1' })],
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2025-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
      apInvoices: [
        ap({ id: 'c', invoiceDate: '2026-04-15', totalCents: 30_000_00 }),
      ],
    });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]?.priorArBilledCents).toBe(50_000_00);
    expect(r.rows[0]?.currentArBilledCents).toBe(100_000_00);
    expect(r.rows[0]?.arDelta).toBe(50_000_00);
    expect(r.rows[0]?.apDelta).toBe(30_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerJobDetailYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      arInvoices: [],
      apInvoices: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
