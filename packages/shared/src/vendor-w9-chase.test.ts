import { describe, expect, it } from 'vitest';
import { buildVendorW9Chase } from './vendor-w9-chase';
import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '',
    updatedAt: '',
    legalName: 'Acme Subs',
    kind: 'SUBCONTRACTOR',
    is1099Reportable: true,
    w9OnFile: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'api-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Acme Subs',
    invoiceDate: '2026-04-01',
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    lineItems: [],
    ...over,
  } as ApInvoice;
}

describe('buildVendorW9Chase', () => {
  it('flags OVER_THRESHOLD_NO_W9 when YTD >= $600 with no W-9', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme' })],
      apInvoices: [ap({ vendorName: 'Acme Subs', totalCents: 1_000_00 })],
    });
    expect(r.rows[0]?.tier).toBe('OVER_THRESHOLD_NO_W9');
    expect(r.rows[0]?.ytdSpendCents).toBe(1_000_00);
  });

  it('flags APPROACHING_NO_W9 between 80% and 100% of threshold', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme' })],
      apInvoices: [ap({ totalCents: 500_00 })], // 500 of 600 = 83%
    });
    expect(r.rows[0]?.tier).toBe('APPROACHING_NO_W9');
  });

  it('flags REPORTABLE_NO_W9 when reportable but spend below approaching', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme' })],
      apInvoices: [ap({ totalCents: 100_00 })],
    });
    expect(r.rows[0]?.tier).toBe('REPORTABLE_NO_W9');
  });

  it('skips vendors with current W-9 on file', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme', w9OnFile: true, w9CollectedOn: '2025-06-01' })],
      apInvoices: [ap({ totalCents: 5_000_00 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('includes vendors with stale W-9 (collected >3y ago)', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme', w9OnFile: true, w9CollectedOn: '2022-01-01' })],
      apInvoices: [ap({ totalCents: 5_000_00 })],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.tier).toBe('OVER_THRESHOLD_NO_W9');
  });

  it('skips vendors not flagged is1099Reportable', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-supp', is1099Reportable: false })],
      apInvoices: [ap({ totalCents: 99_999_00 })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('only counts AP invoices in the requested year', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme' })],
      apInvoices: [
        ap({ id: '1', invoiceDate: '2025-12-15', totalCents: 99_999_00 }),
        ap({ id: '2', invoiceDate: '2026-04-01', totalCents: 50_00 }),
      ],
    });
    expect(r.rows[0]?.ytdSpendCents).toBe(50_00);
  });

  it('skips DRAFT + REJECTED AP invoices', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [vendor({ id: 'v-acme' })],
      apInvoices: [
        ap({ id: '1', status: 'DRAFT', totalCents: 99_999_00 }),
        ap({ id: '2', status: 'REJECTED', totalCents: 99_999_00 }),
        ap({ id: '3', status: 'APPROVED', totalCents: 700_00 }),
      ],
    });
    expect(r.rows[0]?.ytdSpendCents).toBe(700_00);
    expect(r.rows[0]?.tier).toBe('OVER_THRESHOLD_NO_W9');
  });

  it('rollup tallies tiers + over-threshold spend', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [
        vendor({ id: 'a', legalName: 'A' }),
        vendor({ id: 'b', legalName: 'B' }),
        vendor({ id: 'c', legalName: 'C' }),
      ],
      apInvoices: [
        ap({ vendorName: 'A', totalCents: 1_000_00 }),
        ap({ vendorName: 'B', totalCents: 500_00 }),
        ap({ vendorName: 'C', totalCents: 100_00 }),
      ],
    });
    expect(r.rollup.overThreshold).toBe(1);
    expect(r.rollup.approaching).toBe(1);
    expect(r.rollup.reportable).toBe(1);
    expect(r.rollup.overThresholdSpendCents).toBe(1_000_00);
  });

  it('sorts OVER first, then APPROACHING, then REPORTABLE; highest spend first within tier', () => {
    const r = buildVendorW9Chase({
      asOf: '2026-04-27',
      year: 2026,
      vendors: [
        vendor({ id: 'small-over', legalName: 'Small Over' }),
        vendor({ id: 'big-over', legalName: 'Big Over' }),
        vendor({ id: 'approach', legalName: 'Approach' }),
        vendor({ id: 'cold', legalName: 'Cold' }),
      ],
      apInvoices: [
        ap({ vendorName: 'Small Over', totalCents: 700_00 }),
        ap({ vendorName: 'Big Over', totalCents: 5_000_00 }),
        ap({ vendorName: 'Approach', totalCents: 500_00 }),
        ap({ vendorName: 'Cold', totalCents: 100_00 }),
      ],
    });
    expect(r.rows.map((x) => x.vendorId)).toEqual([
      'big-over',
      'small-over',
      'approach',
      'cold',
    ]);
  });
});
