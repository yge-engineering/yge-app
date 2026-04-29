import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildJobBillingBySource } from './job-billing-by-source';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildJobBillingBySource', () => {
  it('groups by (job, source)', () => {
    const r = buildJobBillingBySource({
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', source: 'PROGRESS' }),
        ar({ id: 'b', jobId: 'j1', source: 'MANUAL' }),
        ar({ id: 'c', jobId: 'j2', source: 'PROGRESS' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents and counts invoices', () => {
    const r = buildJobBillingBySource({
      arInvoices: [
        ar({ id: 'a', totalCents: 30_000_00 }),
        ar({ id: 'b', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('tracks first + last invoice date', () => {
    const r = buildJobBillingBySource({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-02-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2026-02-15');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-15');
  });

  it('respects fromDate / toDate', () => {
    const r = buildJobBillingBySource({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCents).toBe(100_000_00);
  });

  it('sorts by jobId asc, totalCents desc within job', () => {
    const r = buildJobBillingBySource({
      arInvoices: [
        ar({ id: 'a', jobId: 'A', source: 'PROGRESS', totalCents: 5_000_00 }),
        ar({ id: 'b', jobId: 'A', source: 'MANUAL', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.source).toBe('MANUAL');
  });

  it('handles empty input', () => {
    const r = buildJobBillingBySource({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
