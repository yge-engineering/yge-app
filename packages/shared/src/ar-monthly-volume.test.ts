import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildArMonthlyVolume } from './ar-monthly-volume';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    source: 'PROGRESS',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildArMonthlyVolume', () => {
  it('buckets invoices by yyyy-mm of invoiceDate', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-03-15' }),
        ar({ id: 'b', invoiceDate: '2026-04-10' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts every status separately', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 's', status: 'SENT' }),
        ar({ id: 'pp', status: 'PARTIALLY_PAID' }),
        ar({ id: 'p', status: 'PAID' }),
        ar({ id: 'di', status: 'DISPUTED' }),
        ar({ id: 'wo', status: 'WRITTEN_OFF' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.draft).toBe(1);
    expect(row?.sent).toBe(1);
    expect(row?.partiallyPaid).toBe(1);
    expect(row?.paid).toBe(1);
    expect(row?.disputed).toBe(1);
    expect(row?.writtenOff).toBe(1);
    expect(row?.total).toBe(6);
  });

  it('sums totalCents per month', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'a', totalCents: 30_000_00 }),
        ar({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
  });

  it('counts distinct customers per month (canonicalized)', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
        ar({ id: 'c', customerName: 'BLM Redding' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildArMonthlyVolume({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'mar', invoiceDate: '2026-03-15' }),
        ar({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month count + amount changes', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'mar1', invoiceDate: '2026-03-15', totalCents: 10_000_00 }),
        ar({ id: 'apr1', invoiceDate: '2026-04-10', totalCents: 30_000_00 }),
        ar({ id: 'apr2', invoiceDate: '2026-04-15', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.monthOverMonthCountChange).toBe(1);
    expect(r.rollup.monthOverMonthAmountChange).toBe(40_000_00);
  });

  it('rolls up portfolio totals', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'a', totalCents: 10_000_00 }),
        ar({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(2);
    expect(r.rollup.totalAmountCents).toBe(30_000_00);
  });

  it('sorts by month asc', () => {
    const r = buildArMonthlyVolume({
      arInvoices: [
        ar({ id: 'late', invoiceDate: '2026-04-15' }),
        ar({ id: 'early', invoiceDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildArMonthlyVolume({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
