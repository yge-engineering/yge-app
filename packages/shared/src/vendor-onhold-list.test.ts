import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorOnHoldList } from './vendor-onhold-list';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'ACME',
    kind: 'SUPPLIER',
    paymentTerms: 'NET_30',
    state: 'CA',
    w9OnFile: true,
    coiOnFile: false,
    is1099Reportable: false,
    onHold: true,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'ACME',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorOnHoldList', () => {
  it('only includes on-hold vendors', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [
        vend({ id: 'on', onHold: true }),
        vend({ id: 'off', onHold: false }),
      ],
      apInvoices: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sums YTD spend per vendor', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [vend({ id: 'v1', legalName: 'A', onHold: true })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', totalCents: 30_000_00 }),
        ap({ id: 'b', vendorName: 'A', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.ytdSpendCents).toBe(50_000_00);
    expect(r.rows[0]?.ytdInvoiceCount).toBe(2);
  });

  it('skips invoices before ytdStart', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'old', vendorName: 'A', invoiceDate: '2025-12-15', totalCents: 99_000_00 }),
        ap({ id: 'new', vendorName: 'A', invoiceDate: '2026-04-15', totalCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.ytdSpendCents).toBe(10_000_00);
  });

  it('matches by canonicalized vendor name', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [vend({ id: 'v1', legalName: 'ACME Construction Inc.' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'ACME CONSTRUCTION, INC' }),
        ap({ id: 'b', vendorName: 'acme construction' }),
      ],
    });
    expect(r.rows[0]?.ytdInvoiceCount).toBe(2);
  });

  it('tracks last invoice date', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', invoiceDate: '2026-02-15' }),
        ap({ id: 'b', vendorName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-15');
  });

  it('uses dbaName when present, falls back to legalName', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [
        vend({ id: 'a', legalName: 'A', dbaName: 'ABC Trucking' }),
        vend({ id: 'b', legalName: 'B' }),
      ],
      apInvoices: [],
    });
    const a = r.rows.find((x) => x.vendorId === 'a');
    const b = r.rows.find((x) => x.vendorId === 'b');
    expect(a?.vendorName).toBe('ABC Trucking');
    expect(b?.vendorName).toBe('B');
  });

  it('sorts by ytdSpendCents desc', () => {
    const r = buildVendorOnHoldList({
      ytdStart: '2026-01-01',
      vendors: [
        vend({ id: 'small', legalName: 'Small' }),
        vend({ id: 'big', legalName: 'Big' }),
      ],
      apInvoices: [
        ap({ id: 's', vendorName: 'Small', totalCents: 5_000_00 }),
        ap({ id: 'b', vendorName: 'Big', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildVendorOnHoldList({ vendors: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
