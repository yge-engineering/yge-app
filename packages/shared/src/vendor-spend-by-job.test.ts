import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorSpendByJob } from './vendor-spend-by-job';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorSpendByJob', () => {
  it('groups by (vendor, job)', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1' }),
        ap({ id: 'b', vendorName: 'Granite', jobId: 'j2' }),
        ap({ id: 'c', vendorName: 'CalPortland', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents and counts invoices per pair', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', totalCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(50_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('canonicalizes vendor name', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite Construction Inc.' }),
        ap({ id: 'b', vendorName: 'GRANITE CONSTRUCTION' }),
      ],
    });
    expect(r.rollup.vendorsConsidered).toBe(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('tracks first/last invoice date and distinct months', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-02-15' }),
        ap({ id: 'b', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', invoiceDate: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2026-02-15');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-25');
    expect(r.rows[0]?.distinctMonths).toBe(2);
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildVendorSpendByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.vendorsConsidered).toBe(1);
  });

  it('sorts by vendor asc, totalCents desc within vendor', () => {
    const r = buildVendorSpendByJob({
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', jobId: 'j1', totalCents: 5_000_00 }),
        ap({ id: 'b', vendorName: 'A', jobId: 'j2', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j2');
  });

  it('handles empty input', () => {
    const r = buildVendorSpendByJob({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
