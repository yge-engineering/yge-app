import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildVendorSpendByKindMonthly } from './vendor-spend-by-kind-monthly';

function vend(over: Partial<Vendor>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    legalName: 'Granite',
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
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 50_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorSpendByKindMonthly', () => {
  it('groups by (kind, month)', () => {
    const r = buildVendorSpendByKindMonthly({
      vendors: [
        vend({ id: 'v1', legalName: 'A', kind: 'SUBCONTRACTOR' }),
        vend({ id: 'v2', legalName: 'B', kind: 'SUPPLIER' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', vendorName: 'B', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', vendorName: 'A', invoiceDate: '2026-03-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums cents per pair', () => {
    const r = buildVendorSpendByKindMonthly({
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', totalCents: 30_000_00 }),
        ap({ id: 'b', vendorName: 'A', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
  });

  it('counts unmatched invoices', () => {
    const r = buildVendorSpendByKindMonthly({
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A' }),
        ap({ id: 'orphan', vendorName: 'Unknown' }),
      ],
    });
    expect(r.rollup.unmatchedInvoices).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildVendorSpendByKindMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      vendors: [vend({ id: 'v1', legalName: 'A' })],
      apInvoices: [
        ap({ id: 'old', vendorName: 'A', invoiceDate: '2026-03-15' }),
        ap({ id: 'in', vendorName: 'A', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by kind asc, month asc', () => {
    const r = buildVendorSpendByKindMonthly({
      vendors: [
        vend({ id: 'v1', legalName: 'A', kind: 'SUPPLIER' }),
        vend({ id: 'v2', legalName: 'B', kind: 'SUBCONTRACTOR' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'A', invoiceDate: '2026-04-15' }),
        ap({ id: 'b', vendorName: 'B', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('SUBCONTRACTOR');
  });

  it('handles empty input', () => {
    const r = buildVendorSpendByKindMonthly({ vendors: [], apInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
