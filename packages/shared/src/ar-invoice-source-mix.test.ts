import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildArInvoiceSourceMix } from './ar-invoice-source-mix';

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

describe('buildArInvoiceSourceMix', () => {
  it('groups by source', () => {
    const r = buildArInvoiceSourceMix({
      arInvoices: [
        ar({ id: 'a', source: 'PROGRESS' }),
        ar({ id: 'b', source: 'PROGRESS' }),
        ar({ id: 'c', source: 'MANUAL' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const progress = r.rows.find((x) => x.source === 'PROGRESS');
    expect(progress?.count).toBe(2);
  });

  it('sums totalCents and computes avgCents', () => {
    const r = buildArInvoiceSourceMix({
      arInvoices: [
        ar({ id: 'a', totalCents: 30_000_00 }),
        ar({ id: 'b', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.avgCents).toBe(50_000_00);
  });

  it('counts distinct jobs and customers per source', () => {
    const r = buildArInvoiceSourceMix({
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', customerName: 'A' }),
        ar({ id: 'b', jobId: 'j2', customerName: 'A' }),
        ar({ id: 'c', jobId: 'j1', customerName: 'B' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('computes share', () => {
    const r = buildArInvoiceSourceMix({
      arInvoices: [
        ar({ id: 'big', source: 'PROGRESS', totalCents: 80_000_00 }),
        ar({ id: 'small', source: 'MANUAL', totalCents: 20_000_00 }),
      ],
    });
    const big = r.rows.find((x) => x.source === 'PROGRESS');
    expect(big?.share).toBeCloseTo(0.8, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildArInvoiceSourceMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildArInvoiceSourceMix({
      arInvoices: [
        ar({ id: 'small', source: 'MANUAL', totalCents: 5_000_00 }),
        ar({ id: 'big', source: 'PROGRESS', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.source).toBe('PROGRESS');
  });

  it('handles empty input', () => {
    const r = buildArInvoiceSourceMix({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
