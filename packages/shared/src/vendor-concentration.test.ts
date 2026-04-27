import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorConcentration } from './vendor-concentration';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-02-01',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildVendorConcentration', () => {
  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ id: 'ap-1', status: 'DRAFT', totalCents: 1_000_00 }),
        ap({ id: 'ap-2', status: 'REJECTED', totalCents: 1_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects start/end date filter', () => {
    const r = buildVendorConcentration({
      start: '2026-04-01',
      end: '2026-04-30',
      apInvoices: [
        ap({ id: 'ap-1', invoiceDate: '2026-03-31', totalCents: 9_999_00 }),
        ap({ id: 'ap-2', invoiceDate: '2026-04-15', totalCents: 100_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.spendCents).toBe(100_00);
  });

  it('case-insensitively collapses vendor names by default', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Acme Supply LLC', totalCents: 100_00 }),
        ap({ id: 'ap-2', vendorName: 'ACME SUPPLY LLC', totalCents: 200_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.spendCents).toBe(300_00);
  });

  it('counts distinct jobs per vendor', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'Acme', jobId: 'job-1' }),
        ap({ id: 'ap-2', vendorName: 'Acme', jobId: 'job-1' }),
        ap({ id: 'ap-3', vendorName: 'Acme', jobId: 'job-2' }),
        ap({ id: 'ap-4', vendorName: 'Acme', jobId: undefined }),
      ],
    });
    expect(r.rows[0]?.jobCount).toBe(2);
  });

  it('sorts vendors by spend desc', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ id: 'ap-a', vendorName: 'Alpha', totalCents: 100_00 }),
        ap({ id: 'ap-b', vendorName: 'Beta', totalCents: 500_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Beta');
    expect(r.rows[1]?.vendorName).toBe('Alpha');
  });

  it('computes top1 / top3 / top5 share', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ id: 'ap-1', vendorName: 'V1', totalCents: 500_00 }),
        ap({ id: 'ap-2', vendorName: 'V2', totalCents: 200_00 }),
        ap({ id: 'ap-3', vendorName: 'V3', totalCents: 100_00 }),
        ap({ id: 'ap-4', vendorName: 'V4', totalCents: 100_00 }),
        ap({ id: 'ap-5', vendorName: 'V5', totalCents: 100_00 }),
      ],
    });
    // total = 1_000_00 → V1 = 0.5
    expect(r.top1SharePct).toBe(0.5);
    // V1+V2+V3 = 800_00 / 1_000_00 = 0.8
    expect(r.top3SharePct).toBe(0.8);
    expect(r.top5SharePct).toBe(1);
  });

  it('computes HHI (Herfindahl) — monopoly = 10000', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [
        ap({ vendorName: 'Solo', totalCents: 1_000_00 }),
      ],
    });
    expect(r.hhi).toBe(10_000);
  });

  it('handles zero spend gracefully', () => {
    const r = buildVendorConcentration({
      start: '2026-01-01',
      end: '2026-12-31',
      apInvoices: [],
    });
    expect(r.totalSpendCents).toBe(0);
    expect(r.top1SharePct).toBe(0);
    expect(r.hhi).toBe(0);
  });
});
