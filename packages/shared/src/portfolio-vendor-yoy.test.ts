import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildPortfolioVendorYoy } from './portfolio-vendor-yoy';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 30_000_00,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildPortfolioVendorYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioVendorYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-04-15', totalCents: 80_000_00 }),
        ap({ id: 'b', invoiceDate: '2026-04-15', totalCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(80_000_00);
    expect(r.currentTotalCents).toBe(100_000_00);
    expect(r.totalCentsDelta).toBe(20_000_00);
  });

  it('counts distinct vendors with canonicalization', () => {
    const r = buildPortfolioVendorYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite' }),
        ap({ id: 'b', vendorName: 'Granite, Inc' }),
        ap({ id: 'c', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.currentDistinctVendors).toBe(2);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioVendorYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('ignores out-of-window dates', () => {
    const r = buildPortfolioVendorYoy({
      currentYear: 2026,
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2024-04-15' }),
      ],
    });
    expect(r.priorTotalCents).toBe(0);
    expect(r.currentTotalCents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorYoy({ currentYear: 2026, apInvoices: [] });
    expect(r.currentInvoiceCount).toBe(0);
  });
});
