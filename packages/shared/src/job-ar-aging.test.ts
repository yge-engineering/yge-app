import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildJobArAging } from './job-ar-aging';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildJobArAging', () => {
  it('returns null worstBucket when job has no open AR', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [],
    });
    expect(r.rows[0]?.worstBucket).toBe(null);
    expect(r.rows[0]?.openInvoiceCount).toBe(0);
  });

  it('skips DRAFT, PAID, WRITTEN_OFF', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'p', status: 'PAID', paidCents: 100_00 }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
      ],
    });
    expect(r.rows[0]?.openInvoiceCount).toBe(0);
  });

  it('skips zero-balance open invoices', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ status: 'PARTIALLY_PAID', totalCents: 100_00, paidCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.openInvoiceCount).toBe(0);
  });

  it('buckets each invoice by days past effective due date', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'fresh', invoiceDate: '2026-04-15' }),       // 0-30
        ar({ id: 'b0', invoiceDate: '2026-03-15' }),          // 0-30
        ar({ id: 'b31', invoiceDate: '2026-02-01' }),         // 31-60
        ar({ id: 'b61', invoiceDate: '2026-01-01' }),         // 61-90
        ar({ id: 'b90', invoiceDate: '2025-10-01' }),         // 90+
      ],
    });
    expect(r.rows[0]?.bucket0to30Count).toBe(2);
    expect(r.rows[0]?.bucket31to60Count).toBe(1);
    expect(r.rows[0]?.bucket61to90Count).toBe(1);
    expect(r.rows[0]?.bucket90PlusCount).toBe(1);
  });

  it('captures oldest invoice date and days since', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'newer', invoiceDate: '2026-04-01' }),
        ar({ id: 'older', invoiceDate: '2026-01-15' }),
      ],
    });
    expect(r.rows[0]?.oldestInvoiceDate).toBe('2026-01-15');
    expect(r.rows[0]?.daysSinceOldest).toBe(102);
  });

  it('sets worstBucket from highest age band', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'recent', invoiceDate: '2026-04-15' }),
        ar({ id: 'old', invoiceDate: '2025-10-01' }),
      ],
    });
    expect(r.rows[0]?.worstBucket).toBe('90+');
  });

  it('flags jobs-with-danger in rollup', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j-old' }), job({ id: 'j-fresh' })],
      arInvoices: [
        ar({ jobId: 'j-old', invoiceDate: '2025-10-01' }),
        ar({ jobId: 'j-fresh', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.jobsWithDangerBucket).toBe(1);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      arInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals across jobs', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', totalCents: 100_00 }),
        ar({ id: 'b', jobId: 'j2', totalCents: 200_00 }),
      ],
    });
    expect(r.rollup.totalOpenInvoices).toBe(2);
    expect(r.rollup.totalOutstandingCents).toBe(300_00);
  });

  it('sorts worst bucket first; daysSinceOldest desc within tier', () => {
    const r = buildJobArAging({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-fresh' }),
        job({ id: 'j-old1' }),
        job({ id: 'j-old2' }),
      ],
      arInvoices: [
        ar({ jobId: 'j-fresh', invoiceDate: '2026-04-15' }),
        ar({ id: 'b1', jobId: 'j-old1', invoiceDate: '2025-10-01' }),
        ar({ id: 'b2', jobId: 'j-old2', invoiceDate: '2025-08-01' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-old2');
    expect(r.rows[1]?.jobId).toBe('j-old1');
    expect(r.rows[2]?.jobId).toBe('j-fresh');
  });
});
