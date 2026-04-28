import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorLifetime } from './vendor-lifetime';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildVendorLifetime', () => {
  it('groups by canonicalized vendor name', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme' }),
        ap({ id: 'b', vendorName: 'ACME, INC.' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('sums invoiced + paid + outstanding', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'a', totalCents: 100_00, paidCents: 30_00 }),
      ],
    });
    expect(r.rows[0]?.totalInvoicedCents).toBe(100_00);
    expect(r.rows[0]?.totalPaidCents).toBe(30_00);
    expect(r.rows[0]?.outstandingCents).toBe(70_00);
  });

  it('counts distinct jobs (only when jobId present)', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: 'j2' }),
        ap({ id: 'c', jobId: undefined }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('captures first/last + lifetime span', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2025-01-15' }),
        ap({ id: 'new', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2025-01-15');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-15');
    expect(r.rows[0]?.lifetimeSpanDays).toBe(455);
  });

  it('skips DRAFT and REJECTED', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'd', status: 'DRAFT' }),
        ap({ id: 'r', status: 'REJECTED' }),
        ap({ id: 'a', status: 'APPROVED' }),
      ],
    });
    expect(r.rollup.vendorsConsidered).toBe(1);
  });

  it('sorts by invoiced desc', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'small', vendorName: 'Small', totalCents: 1_00 }),
        ap({ id: 'big', vendorName: 'Big', totalCents: 1000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Big');
  });

  it('rolls up portfolio totals', () => {
    const r = buildVendorLifetime({
      apInvoices: [
        ap({ id: 'a', totalCents: 100_00, paidCents: 50_00 }),
        ap({ id: 'b', totalCents: 200_00, paidCents: 100_00 }),
      ],
    });
    expect(r.rollup.totalInvoicedCents).toBe(300_00);
    expect(r.rollup.totalPaidCents).toBe(150_00);
    expect(r.rollup.totalOutstandingCents).toBe(150_00);
  });

  it('handles empty input', () => {
    const r = buildVendorLifetime({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
