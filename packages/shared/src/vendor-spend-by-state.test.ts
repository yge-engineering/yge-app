import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorSpendByState } from './vendor-spend-by-state';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Granite',
    kind: 'SUBCONTRACTOR',
    state: 'CA',
    is1099Reportable: false,
    w9OnFile: false,
    onHold: false,
    ...over,
  } as Vendor;
}

function inv(over: Partial<ApInvoice>): ApInvoice {
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

describe('buildVendorSpendByState', () => {
  it('groups invoices by state via vendor join', () => {
    const r = buildVendorSpendByState({
      vendors: [
        vend({ id: 'v1', legalName: 'Granite', state: 'CA' }),
        vend({ id: 'v2', legalName: 'Bob Trucking', state: 'NV' }),
      ],
      apInvoices: [
        inv({ id: 'a', vendorName: 'Granite' }),
        inv({ id: 'b', vendorName: 'Bob Trucking' }),
        inv({ id: 'c', vendorName: 'Granite' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums totalCents + paidCents per state', () => {
    const r = buildVendorSpendByState({
      vendors: [vend({ id: 'v1', legalName: 'Granite', state: 'CA' })],
      apInvoices: [
        inv({ id: 'a', totalCents: 100_000_00, paidCents: 30_000_00 }),
        inv({ id: 'b', totalCents: 50_000_00, paidCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(150_000_00);
    expect(r.rows[0]?.paidCents).toBe(80_000_00);
    expect(r.rows[0]?.openCents).toBe(70_000_00);
  });

  it('canonicalizes vendor name when joining', () => {
    const r = buildVendorSpendByState({
      vendors: [vend({ id: 'v1', legalName: 'Granite Inc', state: 'CA' })],
      apInvoices: [
        inv({ id: 'a', vendorName: 'GRANITE, INC.' }),
        inv({ id: 'b', vendorName: 'Granite Inc' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('counts distinct vendors + jobs', () => {
    const r = buildVendorSpendByState({
      vendors: [
        vend({ id: 'v1', legalName: 'A', state: 'CA' }),
        vend({ id: 'v2', legalName: 'B', state: 'CA' }),
      ],
      apInvoices: [
        inv({ id: 'a', vendorName: 'A', jobId: 'j1' }),
        inv({ id: 'b', vendorName: 'B', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed invoices (no matching vendor)', () => {
    const r = buildVendorSpendByState({
      vendors: [vend({ id: 'v1', legalName: 'Granite', state: 'CA' })],
      apInvoices: [
        inv({ id: 'a', vendorName: 'Granite' }),
        inv({ id: 'b', vendorName: 'Unknown' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate', () => {
    const r = buildVendorSpendByState({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      vendors: [vend({ id: 'v1', legalName: 'Granite', state: 'CA' })],
      apInvoices: [
        inv({ id: 'old', invoiceDate: '2026-03-15' }),
        inv({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildVendorSpendByState({
      vendors: [
        vend({ id: 'v1', legalName: 'A', state: 'CA' }),
        vend({ id: 'v2', legalName: 'B', state: 'NV' }),
      ],
      apInvoices: [
        inv({ id: 'a', vendorName: 'A', totalCents: 50_000_00 }),
        inv({ id: 'b', vendorName: 'B', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.state).toBe('NV');
  });

  it('handles empty input', () => {
    const r = buildVendorSpendByState({ vendors: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
