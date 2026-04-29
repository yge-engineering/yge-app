import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorSpendMonthly } from './vendor-spend-monthly';

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

describe('buildVendorSpendMonthly', () => {
  it('groups by (canonicalized vendor, month)', () => {
    const r = buildVendorSpendMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', invoiceDate: '2026-03-15' }),
        ap({ id: 'b', vendorName: 'Granite', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', vendorName: 'CalPortland', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('canonicalizes (LLC/Inc stripped, lowercase, punctuation stripped)', () => {
    const r = buildVendorSpendMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction Co' }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION, INC.' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('sums totalCents and counts distinct jobs per pair', () => {
    const r = buildVendorSpendMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', totalCents: 30_000_00 }),
        ap({ id: 'b', jobId: 'j2', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(50_000_00);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildVendorSpendMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [
        ap({ id: 'mar', invoiceDate: '2026-03-15' }),
        ap({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by vendor asc then month asc', () => {
    const r = buildVendorSpendMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Z', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', vendorName: 'A', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', vendorName: 'A', invoiceDate: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('rolls up portfolio totals', () => {
    const r = buildVendorSpendMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', totalCents: 30_000_00 }),
        ap({ id: 'b', vendorName: 'B', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rollup.totalCents).toBe(100_000_00);
    expect(r.rollup.vendorsConsidered).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildVendorSpendMonthly({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
