import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendor1099Monthly } from './vendor-1099-monthly';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'A',
    kind: 'SUBCONTRACTOR',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    coiOnFile: false,
    is1099Reportable: true,
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'A',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 50_000,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendor1099Monthly', () => {
  it('skips vendors not flagged 1099-reportable', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-12',
      vendors: [
        vend({ id: 'rep', legalName: 'Rep', is1099Reportable: true }),
        vend({ id: 'norep', legalName: 'NoRep', is1099Reportable: false }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Rep' }),
        ap({ id: 'b', vendorName: 'NoRep' }),
      ],
    });
    expect(r.rows.every((x) => x.vendorId === 'rep')).toBe(true);
  });

  it('builds running YTD per vendor', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-12',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', invoiceDate: '2026-02-15', totalCents: 200_00 }),
        ap({ id: 'b', vendorName: 'A', invoiceDate: '2026-04-15', totalCents: 500_00 }),
      ],
    });
    expect(r.rows[0]?.ytdCents).toBe(200_00);
    expect(r.rows[1]?.ytdCents).toBe(700_00);
  });

  it('flags crossedThreshold once ytd >= $600', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-12',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', invoiceDate: '2026-02-15', totalCents: 500_00 }),
        ap({ id: 'b', vendorName: 'A', invoiceDate: '2026-04-15', totalCents: 200_00 }),
      ],
    });
    expect(r.rows[0]?.crossedThreshold).toBe(false);
    expect(r.rows[1]?.crossedThreshold).toBe(true);
    expect(r.rollup.thresholdCrossings).toBe(1);
  });

  it('respects toMonth cap', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-03',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'feb', vendorName: 'A', invoiceDate: '2026-02-15' }),
        ap({ id: 'apr', vendorName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows.map((x) => x.month)).toEqual(['2026-02']);
  });

  it('skips invoices before ytdStart', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-12',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'old', vendorName: 'A', invoiceDate: '2025-12-15', totalCents: 100_000 }),
        ap({ id: 'new', vendorName: 'A', invoiceDate: '2026-04-15', totalCents: 100_00 }),
      ],
    });
    expect(r.rows[0]?.ytdCents).toBe(100_00);
  });

  it('sorts by vendorName asc then month asc', () => {
    const r = buildVendor1099Monthly({
      ytdStart: '2026-01-01',
      toMonth: '2026-12',
      vendors: [
        vend({ id: 'z', legalName: 'Z' }),
        vend({ id: 'a', legalName: 'A' }),
      ],
      apInvoices: [
        ap({ id: 'z1', vendorName: 'Z', invoiceDate: '2026-04-15' }),
        ap({ id: 'a1', vendorName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildVendor1099Monthly({ vendors: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
