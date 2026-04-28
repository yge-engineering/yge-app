import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorInvoiceSize } from './vendor-invoice-size';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildVendorInvoiceSize', () => {
  it('groups invoices by canonicalized vendor name', () => {
    const r = buildVendorInvoiceSize({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Supply' }),
        ap({ id: 'b', vendorName: 'ACME SUPPLY, INC.' }),
        ap({ id: 'c', vendorName: 'acme supply co' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(3);
  });

  it('computes mean, median, stdDev', () => {
    // Totals: 100, 200, 300, 400, 500 cents (in 100s of cents)
    const r = buildVendorInvoiceSize({
      apInvoices: [
        ap({ id: 'a', totalCents: 100 }),
        ap({ id: 'b', totalCents: 200 }),
        ap({ id: 'c', totalCents: 300 }),
        ap({ id: 'd', totalCents: 400 }),
        ap({ id: 'e', totalCents: 500 }),
      ],
    });
    const row = r.rows[0];
    expect(row?.meanCents).toBe(300);
    expect(row?.medianCents).toBe(300);
    // stdDev (sample): sqrt(((200²)*2 + (100²)*2)/4) = sqrt(25000) ≈ 158.11
    expect(row?.stdDevCents).toBe(158);
    expect(row?.minCents).toBe(100);
    expect(row?.maxCents).toBe(500);
  });

  it('flags outliers above the z-score threshold', () => {
    // Median 100, stdDev huge because of the 10000 outlier.
    // Use threshold 1.5 so the 10000 outlier definitely lands.
    const r = buildVendorInvoiceSize({
      outlierZThreshold: 1.5,
      apInvoices: [
        ap({ id: 'a', totalCents: 100 }),
        ap({ id: 'b', totalCents: 110 }),
        ap({ id: 'c', totalCents: 95 }),
        ap({ id: 'd', totalCents: 105 }),
        ap({ id: 'e', totalCents: 10000 }), // typo-style outlier
      ],
    });
    const outliers = r.rows[0]?.outliers ?? [];
    expect(outliers.length).toBeGreaterThanOrEqual(1);
    expect(outliers[0]?.invoiceId).toBe('e');
    expect(outliers[0]?.zScore).toBeGreaterThan(1.5);
  });

  it('skips outlier flagging when below minInvoicesForStats', () => {
    // 3 invoices < default minN of 4 — no outliers regardless.
    const r = buildVendorInvoiceSize({
      apInvoices: [
        ap({ id: 'a', totalCents: 100 }),
        ap({ id: 'b', totalCents: 100 }),
        ap({ id: 'c', totalCents: 99999 }),
      ],
    });
    expect(r.rows[0]?.outliers).toHaveLength(0);
    expect(r.rollup.totalOutliers).toBe(0);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorInvoiceSize({
      apInvoices: [
        ap({ id: 'a', status: 'DRAFT' }),
        ap({ id: 'b', status: 'REJECTED' }),
        ap({ id: 'c', status: 'APPROVED' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildVendorInvoiceSize({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
        ap({ id: 'after', invoiceDate: '2026-05-15' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('sorts rows by totalCents desc — biggest spenders first', () => {
    const r = buildVendorInvoiceSize({
      apInvoices: [
        ap({ id: 'small1', vendorName: 'Small Vendor', totalCents: 50_00 }),
        ap({ id: 'big1', vendorName: 'Big Vendor', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Big Vendor');
  });

  it('handles single-invoice vendor without crashing', () => {
    const r = buildVendorInvoiceSize({
      apInvoices: [ap({ id: 'only', totalCents: 12345 })],
    });
    expect(r.rows[0]?.invoiceCount).toBe(1);
    expect(r.rows[0]?.stdDevCents).toBe(0);
    expect(r.rows[0]?.outliers).toHaveLength(0);
  });

  it('handles empty input', () => {
    const r = buildVendorInvoiceSize({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.invoicesConsidered).toBe(0);
  });
});
