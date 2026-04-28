import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildApMonthlyVolume } from './ap-monthly-volume';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite Construction',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildApMonthlyVolume', () => {
  it('buckets invoices by yyyy-mm of invoiceDate', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-03-15' }),
        ap({ id: 'b', invoiceDate: '2026-04-10' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts every status separately', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }),
        ap({ id: 'p', status: 'PENDING' }),
        ap({ id: 'a', status: 'APPROVED' }),
        ap({ id: 'pd', status: 'PAID' }),
        ap({ id: 'r', status: 'REJECTED' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.draft).toBe(1);
    expect(row?.pending).toBe(1);
    expect(row?.approved).toBe(1);
    expect(row?.paid).toBe(1);
    expect(row?.rejected).toBe(1);
    expect(row?.total).toBe(5);
  });

  it('sums totalCents per month', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'a', totalCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
  });

  it('counts distinct vendors per month (canonicalized)', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction Co' }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION, INC.' }),
        ap({ id: 'c', vendorName: 'CalPortland' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildApMonthlyVolume({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [
        ap({ id: 'mar', invoiceDate: '2026-03-15' }),
        ap({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month count + amount changes', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'mar1', invoiceDate: '2026-03-15', totalCents: 10_000_00 }),
        ap({ id: 'apr1', invoiceDate: '2026-04-10', totalCents: 30_000_00 }),
        ap({ id: 'apr2', invoiceDate: '2026-04-15', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.monthOverMonthCountChange).toBe(1);
    expect(r.rollup.monthOverMonthAmountChange).toBe(40_000_00);
  });

  it('rolls up portfolio totals', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'a', totalCents: 10_000_00 }),
        ap({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(2);
    expect(r.rollup.totalAmountCents).toBe(30_000_00);
  });

  it('sorts by month asc', () => {
    const r = buildApMonthlyVolume({
      apInvoices: [
        ap({ id: 'late', invoiceDate: '2026-04-15' }),
        ap({ id: 'early', invoiceDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildApMonthlyVolume({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
