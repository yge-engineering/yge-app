import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildJobArBillingMonthly } from './job-ar-billing-monthly';

function inv(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    subtotalCents: 100_000_00,
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

describe('buildJobArBillingMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobArBillingMonthly({
      arInvoices: [
        inv({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-15' }),
        inv({ id: 'b', jobId: 'j1', invoiceDate: '2026-05-01' }),
        inv({ id: 'c', jobId: 'j2', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents per (job, month)', () => {
    const r = buildJobArBillingMonthly({
      arInvoices: [
        inv({ id: 'a', totalCents: 100_000_00, paidCents: 30_000_00 }),
        inv({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('sums retentionCents', () => {
    const r = buildJobArBillingMonthly({
      arInvoices: [
        inv({ id: 'a', retentionCents: 5_000_00 }),
        inv({ id: 'b', retentionCents: 7_500_00 }),
      ],
    });
    expect(r.rows[0]?.retentionCents).toBe(12_500_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobArBillingMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        inv({ id: 'old', invoiceDate: '2026-03-15' }),
        inv({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobArBillingMonthly({
      arInvoices: [
        inv({ id: 'a', jobId: 'j1', totalCents: 100_000_00, paidCents: 25_000_00 }),
        inv({ id: 'b', jobId: 'j2', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.totalCents).toBe(150_000_00);
    expect(r.rollup.paidCents).toBe(75_000_00);
    expect(r.rollup.openCents).toBe(75_000_00);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobArBillingMonthly({
      arInvoices: [
        inv({ id: 'a', jobId: 'Z', invoiceDate: '2026-04-15' }),
        inv({ id: 'b', jobId: 'A', invoiceDate: '2026-05-01' }),
        inv({ id: 'c', jobId: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobArBillingMonthly({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
