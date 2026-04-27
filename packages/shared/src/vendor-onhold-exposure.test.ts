import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorOnHoldExposure } from './vendor-onhold-exposure';

function vendor(over: Partial<Vendor>): Vendor {
  return {
    id: 'vnd-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    legalName: 'Acme Supply LLC',
    kind: 'SUPPLIER',
    w9OnFile: false,
    is1099Reportable: false,
    coiOnFile: false,
    paymentTerms: 'NET_30',
    onHold: true,
    onHoldReason: 'Quality dispute',
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply LLC',
    invoiceDate: '2026-04-01',
    jobId: 'job-1',
    lineItems: [],
    totalCents: 10_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorOnHoldExposure', () => {
  it('only includes on-hold vendors', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'on', onHold: true }),
        vendor({ id: 'off', onHold: false }),
      ],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorId).toBe('on');
  });

  it('rolls up unpaid PENDING + APPROVED exposure', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'p', status: 'PENDING', totalCents: 50_000_00 }),
        ap({ id: 'a', status: 'APPROVED', totalCents: 20_000_00, paidCents: 5_000_00 }),
        ap({ id: 'd', status: 'DRAFT', totalCents: 99_000_00 }),
      ],
    });
    // 50K + (20K - 5K) = 65K
    expect(r.rows[0]?.unpaidExposureCents).toBe(65_000_00);
    expect(r.rows[0]?.unpaidInvoiceCount).toBe(2);
  });

  it('rolls up paid-while-held when invoice landed in window', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'p1', status: 'PAID', invoiceDate: '2026-02-01', paidCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.recentPaidCents).toBe(10_000_00);
    expect(r.rows[0]?.recentPaidInvoiceCount).toBe(1);
  });

  it('respects recentSince override', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      recentSince: '2026-03-01',
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'p1', status: 'PAID', invoiceDate: '2026-02-15', paidCents: 99_000_00 }),
        ap({ id: 'p2', status: 'PAID', invoiceDate: '2026-04-01', paidCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.recentPaidCents).toBe(5_000_00);
  });

  it('matches AP invoice to vendor by DBA name', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [
        vendor({ legalName: 'Big Company LLC', dbaName: 'BigCo' }),
      ],
      apInvoices: [ap({ vendorName: 'BigCo', status: 'PENDING' })],
    });
    expect(r.rows[0]?.unpaidExposureCents).toBe(10_000_00);
  });

  it('counts distinct jobs touched', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [
        ap({ id: 'a', jobId: 'job-A', status: 'APPROVED' }),
        ap({ id: 'b', jobId: 'job-B', status: 'APPROVED' }),
        ap({ id: 'c', jobId: 'job-A', status: 'APPROVED' }),
      ],
    });
    expect(r.rows[0]?.jobsTouched).toBe(2);
  });

  it('surfaces on-hold vendors with no AP activity (zero rows)', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [vendor({})],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.unpaidExposureCents).toBe(0);
  });

  it('rolls up grand totals + sorts by unpaid exposure desc', () => {
    const r = buildVendorOnHoldExposure({
      asOf: '2026-04-27',
      vendors: [
        vendor({ id: 'v-big', legalName: 'Big' }),
        vendor({ id: 'v-small', legalName: 'Small' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Big', status: 'PENDING', totalCents: 50_000_00 }),
        ap({ id: 'b', vendorName: 'Small', status: 'PENDING', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('v-big');
    expect(r.rollup.totalUnpaidExposureCents).toBe(55_000_00);
    expect(r.rollup.onHoldVendorsConsidered).toBe(2);
  });
});
