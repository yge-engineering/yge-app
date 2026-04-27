import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';
import type { Job } from './job';

import { buildJobBillingCadence } from './job-billing-cadence';

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
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildJobBillingCadence', () => {
  it('flags NEW_JOB when no invoices on the job', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [],
    });
    expect(r.rows[0]?.flag).toBe('NEW_JOB');
    expect(r.rows[0]?.lastInvoiceDate).toBe(null);
  });

  it('flags ON_TRACK when last invoice within 35 days', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [ar({ invoiceDate: '2026-04-15' })], // 12 days ago
    });
    expect(r.rows[0]?.flag).toBe('ON_TRACK');
  });

  it('flags SLIPPING for 36-49 days since last', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [ar({ invoiceDate: '2026-03-15' })], // 43 days
    });
    expect(r.rows[0]?.flag).toBe('SLIPPING');
  });

  it('flags LATE for 50-89 days', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [ar({ invoiceDate: '2026-02-15' })], // 71 days
    });
    expect(r.rows[0]?.flag).toBe('LATE');
  });

  it('flags DARK for 90+ days', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [ar({ invoiceDate: '2025-12-01' })], // 147 days
    });
    expect(r.rows[0]?.flag).toBe('DARK');
  });

  it('skips DRAFT invoices', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'ar-1', status: 'DRAFT', invoiceDate: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('NEW_JOB');
  });

  it('computes avg days between invoices when 2+ exist', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [
        ar({ id: 'ar-1', invoiceDate: '2026-01-15' }),
        ar({ id: 'ar-2', invoiceDate: '2026-02-15' }),  // 31 days
        ar({ id: 'ar-3', invoiceDate: '2026-03-20' }),  // 33 days
      ],
    });
    expect(r.rows[0]?.avgDaysBetweenInvoices).toBe(32);
  });

  it('null avg when only one invoice', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [job({})],
      arInvoices: [ar({ invoiceDate: '2026-04-15' })],
    });
    expect(r.rows[0]?.avgDaysBetweenInvoices).toBe(null);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobBillingCadence({
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

  it('rolls up per-tier counts and total billed', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-on' }),
        job({ id: 'j-dark' }),
        job({ id: 'j-new' }),
      ],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'j-on', invoiceDate: '2026-04-20', totalCents: 30_000_00 }),
        ar({ id: 'ar-2', jobId: 'j-dark', invoiceDate: '2025-12-01', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.onTrack).toBe(1);
    expect(r.rollup.dark).toBe(1);
    expect(r.rollup.newJob).toBe(1);
    expect(r.rollup.totalBilledCents).toBe(50_000_00);
  });

  it('sorts DARK first, then LATE, SLIPPING, ON_TRACK; NEW_JOB pinned last', () => {
    const r = buildJobBillingCadence({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-on' }),
        job({ id: 'j-dark' }),
        job({ id: 'j-new' }),
      ],
      arInvoices: [
        ar({ id: 'ar-1', jobId: 'j-on', invoiceDate: '2026-04-20' }),
        ar({ id: 'ar-2', jobId: 'j-dark', invoiceDate: '2025-12-01' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-dark');
    expect(r.rows[1]?.jobId).toBe('j-on');
    expect(r.rows[2]?.jobId).toBe('j-new');
  });
});
