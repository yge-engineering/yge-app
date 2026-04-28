import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildDailyArBilling } from './daily-ar-billing';

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

describe('buildDailyArBilling', () => {
  it('respects window bounds', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('skips DRAFT by default', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ status: 'DRAFT' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('includes DRAFT when skipDrafts=false', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      skipDrafts: false,
      arInvoices: [ar({ status: 'DRAFT' })],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('groups invoices by issue date', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-15', totalCents: 30_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 20_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-04-30', totalCents: 10_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const day15 = r.rows.find((x) => x.date === '2026-04-15');
    expect(day15?.invoiceCount).toBe(2);
    expect(day15?.billedCents).toBe(50_000_00);
  });

  it('counts distinct customers and jobs per day', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', customerName: 'Cal Fire', jobId: 'job-A' }),
        ar({ id: 'b', customerName: 'Cal Fire', jobId: 'job-B' }),
        ar({ id: 'c', customerName: 'Caltrans', jobId: 'job-A' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('captures peak day', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-01' }),
        ar({ id: 'b', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', invoiceDate: '2026-04-15' }),
        ar({ id: 'd', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.peakInvoiceCount).toBe(3);
    expect(r.rollup.peakInvoiceDate).toBe('2026-04-15');
  });

  it('rolls up totals + average', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-01', totalCents: 100_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-15', totalCents: 200_000_00 }),
      ],
    });
    expect(r.rollup.daysWithBilling).toBe(2);
    expect(r.rollup.totalInvoiceCount).toBe(2);
    expect(r.rollup.totalBilledCents).toBe(300_000_00);
    expect(r.rollup.avgPerActiveDayCents).toBe(150_000_00);
  });

  it('sorts rows by date asc', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'late', invoiceDate: '2026-04-25' }),
        ar({ id: 'early', invoiceDate: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
  });

  it('handles empty input', () => {
    const r = buildDailyArBilling({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakInvoiceDate).toBe(null);
  });
});
