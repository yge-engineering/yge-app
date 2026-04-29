import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildApAgingSummary } from './ap-aging-summary';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildApAgingSummary', () => {
  it('buckets by days past invoiceDate (or dueDate when set)', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [
        ap({ id: 'cur', invoiceDate: '2026-04-28' }), // 0d → CURRENT
        ap({ id: '15', invoiceDate: '2026-04-13' }),  // 15d → PAST_1_30
        ap({ id: '50', invoiceDate: '2026-03-09' }),  // 50d → PAST_31_60
        ap({ id: '80', invoiceDate: '2026-02-07' }),  // 80d → PAST_61_90
        ap({ id: '120', invoiceDate: '2025-12-29' }), // 120d → PAST_90_PLUS
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'CURRENT')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_1_30')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_31_60')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_61_90')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_90_PLUS')?.count).toBe(1);
  });

  it('uses dueDate when set instead of invoiceDate', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [ap({ invoiceDate: '2026-01-01', dueDate: '2026-04-28' })],
    });
    expect(r.rows[0]?.bucket).toBe('CURRENT');
  });

  it('skips PAID and REJECTED invoices', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [
        ap({ id: 'pending', status: 'PENDING' }),
        ap({ id: 'paid', status: 'PAID' }),
        ap({ id: 'rejected', status: 'REJECTED' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('uses unpaid balance (total - paid)', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [
        ap({ id: 'partial', totalCents: 100_000_00, paidCents: 30_000_00 }),
      ],
    });
    expect(r.rollup.totalUnpaidCents).toBe(70_000_00);
  });

  it('counts distinct vendors per bucket', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction' }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION, INC' }),
        ap({ id: 'c', vendorName: 'CalPortland' }),
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'PAST_1_30')?.distinctVendors).toBe(2);
  });

  it('computes share over total unpaid', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [
        ap({ id: 'cur', invoiceDate: '2026-04-28', totalCents: 80_000_00 }),
        ap({ id: '50d', invoiceDate: '2026-03-09', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'CURRENT')?.share).toBeCloseTo(0.8, 3);
  });

  it('returns all five bucket rows in fixed order', () => {
    const r = buildApAgingSummary({
      asOf: '2026-04-28',
      apInvoices: [ap({})],
    });
    expect(r.rows.map((x) => x.bucket)).toEqual([
      'CURRENT', 'PAST_1_30', 'PAST_31_60', 'PAST_61_90', 'PAST_90_PLUS',
    ]);
  });

  it('handles empty input', () => {
    const r = buildApAgingSummary({ apInvoices: [] });
    expect(r.rollup.invoicesConsidered).toBe(0);
  });
});
