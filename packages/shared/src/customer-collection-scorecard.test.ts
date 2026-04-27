import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerCollectionScorecard } from './customer-collection-scorecard';

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
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'PAID',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerCollectionScorecard', () => {
  it('skips DRAFT invoices', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [ar({ status: 'DRAFT', totalCents: 99_000_00 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects window bounds', () => {
    const r = buildCustomerCollectionScorecard({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'ar-old', invoiceDate: '2026-03-15' }),
        ar({ id: 'ar-in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(1);
  });

  it('collapses customer names case-insensitively by default', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({ id: 'ar-1', customerName: 'Cal Fire' }),
        ar({ id: 'ar-2', customerName: 'CAL FIRE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('computes collection rate', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({ id: 'ar-1', totalCents: 100_00, paidCents: 100_00 }),  // collected
        ar({ id: 'ar-2', totalCents: 100_00, paidCents: 0, status: 'SENT' }), // outstanding
      ],
    });
    expect(r.rows[0]?.invoicedCents).toBe(200_00);
    expect(r.rows[0]?.collectedCents).toBe(100_00);
    expect(r.rows[0]?.outstandingCents).toBe(100_00);
    expect(r.rows[0]?.collectionRate).toBe(0.5);
  });

  it('counts WRITTEN_OFF unpaid balance as written-off', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({
          id: 'ar-1',
          totalCents: 100_00,
          paidCents: 30_00,
          status: 'WRITTEN_OFF',
        }),
      ],
    });
    expect(r.rows[0]?.writtenOffCents).toBe(70_00);
    expect(r.rows[0]?.collectedCents).toBe(30_00);
    expect(r.rows[0]?.outstandingCents).toBe(0);
    expect(r.rows[0]?.writeOffRate).toBe(0.7);
  });

  it('flags low-collection customers (<70%)', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({ id: 'a', customerName: 'Slow County', totalCents: 100_00, paidCents: 50_00, status: 'SENT' }),
        ar({ id: 'b', customerName: 'Cal Fire', totalCents: 100_00, paidCents: 100_00 }),
      ],
    });
    expect(r.rollup.lowCollectionCustomers).toBe(1);
  });

  it('rolls up grand totals', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', totalCents: 100_00, paidCents: 50_00, status: 'SENT' }),
        ar({ id: 'b', customerName: 'B', totalCents: 200_00, paidCents: 200_00 }),
      ],
    });
    expect(r.rollup.totalInvoicedCents).toBe(300_00);
    expect(r.rollup.totalCollectedCents).toBe(250_00);
    expect(r.rollup.totalOutstandingCents).toBe(50_00);
  });

  it('sorts lowest collection rate first (credit-risk list)', () => {
    const r = buildCustomerCollectionScorecard({
      arInvoices: [
        ar({ id: 'a', customerName: 'Reliable', totalCents: 100_00, paidCents: 100_00 }),
        ar({ id: 'b', customerName: 'Risky', totalCents: 100_00, paidCents: 30_00, status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Risky');
  });
});
