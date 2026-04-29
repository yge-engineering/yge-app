import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildPortfolioVendorMonthly } from './portfolio-vendor-monthly';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildPortfolioVendorMonthly', () => {
  it('sums billed / paid / open per month', () => {
    const r = buildPortfolioVendorMonthly({
      apInvoices: [
        ap({ totalCents: 100_000_00, paidCents: 30_000_00 }),
        ap({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('counts distinct vendors with canonicalization', () => {
    const r = buildPortfolioVendorMonthly({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite' }),
        ap({ id: 'b', vendorName: 'Granite, Inc' }),
        ap({ id: 'c', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioVendorMonthly({
      apInvoices: [
        ap({ id: 'a', jobId: 'j1' }),
        ap({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioVendorMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apInvoices: [
        ap({ id: 'old', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioVendorMonthly({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-06-15' }),
        ap({ id: 'b', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorMonthly({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
