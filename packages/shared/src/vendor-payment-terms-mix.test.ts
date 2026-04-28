import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorPaymentTermsMix } from './vendor-payment-terms-mix';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'ACME Construction',
    kind: 'SUPPLIER',
    paymentTerms: 'NET_30',
    w9OnFile: true,
    coiOnFile: false,
    is1099Reportable: false,
    onHold: false,
    ...over,
  } as Vendor;
}

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'ACME Construction',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorPaymentTermsMix', () => {
  it('groups invoice $ by vendor terms', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [
        vend({ id: 'v1', legalName: 'A', paymentTerms: 'NET_30' }),
        vend({ id: 'v2', legalName: 'B', paymentTerms: 'NET_60' }),
      ],
      apInvoices: [
        ap({ id: 'i1', vendorName: 'A', totalCents: 50_000_00 }),
        ap({ id: 'i2', vendorName: 'B', totalCents: 30_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const net30 = r.rows.find((x) => x.terms === 'NET_30');
    expect(net30?.totalAmountCents).toBe(50_000_00);
  });

  it('matches by canonicalized vendor name (LLC, Inc, punctuation)', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [
        vend({ id: 'v1', legalName: 'ACME Construction Inc.', paymentTerms: 'NET_30' }),
      ],
      apInvoices: [
        ap({ id: 'i1', vendorName: 'ACME Construction, Inc' }),
        ap({ id: 'i2', vendorName: 'acme construction' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('counts unmatched invoices on rollup', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [vend({ id: 'v1', legalName: 'A', paymentTerms: 'NET_30' })],
      apInvoices: [
        ap({ id: 'a1', vendorName: 'A' }),
        ap({ id: 'orphan', vendorName: 'Unknown Co' }),
      ],
    });
    expect(r.rollup.unmatchedInvoices).toBe(1);
  });

  it('computes share + avg invoice', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [
        vend({ id: 'v1', legalName: 'A', paymentTerms: 'NET_30' }),
        vend({ id: 'v2', legalName: 'B', paymentTerms: 'NET_60' }),
      ],
      apInvoices: [
        ap({ id: 'i1', vendorName: 'A', totalCents: 30_000_00 }),
        ap({ id: 'i2', vendorName: 'A', totalCents: 30_000_00 }),
        ap({ id: 'i3', vendorName: 'B', totalCents: 40_000_00 }),
      ],
    });
    const net30 = r.rows.find((x) => x.terms === 'NET_30');
    expect(net30?.avgInvoiceCents).toBe(30_000_00);
    expect(net30?.share).toBeCloseTo(0.6, 3);
  });

  it('respects fromDate / toDate window on invoiceDate', () => {
    const r = buildVendorPaymentTermsMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'old', vendorName: 'A', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', vendorName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by totalAmountCents desc', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [
        vend({ id: 'v1', legalName: 'A', paymentTerms: 'NET_30' }),
        vend({ id: 'v2', legalName: 'B', paymentTerms: 'COD' }),
      ],
      apInvoices: [
        ap({ id: 'i1', vendorName: 'A', totalCents: 5_000_00 }),
        ap({ id: 'i2', vendorName: 'B', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.terms).toBe('COD');
  });

  it('counts vendor records per term regardless of invoice match', () => {
    const r = buildVendorPaymentTermsMix({
      vendors: [
        vend({ id: 'v1', legalName: 'A', paymentTerms: 'NET_30' }),
        vend({ id: 'v2', legalName: 'B', paymentTerms: 'NET_30' }),
        vend({ id: 'v3', legalName: 'C', paymentTerms: 'NET_30' }),
      ],
      apInvoices: [
        ap({ id: 'i1', vendorName: 'A' }),
      ],
    });
    expect(r.rows[0]?.vendorCount).toBe(3);
  });

  it('handles empty input', () => {
    const r = buildVendorPaymentTermsMix({ vendors: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
