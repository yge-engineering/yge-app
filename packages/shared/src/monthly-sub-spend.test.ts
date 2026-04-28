import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';
import type { Vendor } from './vendor';

import { buildMonthlySubSpend } from './monthly-sub-spend';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Subs',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 10_000_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

function vend(over: Partial<Vendor> & Pick<Vendor, 'legalName' | 'kind'>): Vendor {
  return {
    id: 'v-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    is1099Reportable: false,
    ...over,
  } as Vendor;
}

describe('buildMonthlySubSpend', () => {
  it('only includes AP for SUBCONTRACTOR-flagged vendors', () => {
    const r = buildMonthlySubSpend({
      vendors: [
        vend({ legalName: 'Acme Subs', kind: 'SUBCONTRACTOR' }),
        vend({ legalName: 'Material Co', kind: 'SUPPLIER' }),
      ],
      apInvoices: [
        ap({ id: 'sub', vendorName: 'Acme Subs', totalCents: 10_000_00 }),
        ap({ id: 'mat', vendorName: 'Material Co', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rollup.totalSubSpendCents).toBe(10_000_00);
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('matches subs by canonicalized name (LLC/Inc stripped)', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'ACME SUBS, INC.', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Subs LLC', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rollup.totalSubSpendCents).toBe(5_000_00);
  });

  it('matches subs by dba alias too', () => {
    const r = buildMonthlySubSpend({
      vendors: [
        vend({
          legalName: 'Big Holding Group',
          dbaName: 'Acme Trenching',
          kind: 'SUBCONTRACTOR',
        }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Trenching', totalCents: 7_500_00 }),
      ],
    });
    expect(r.rollup.totalSubSpendCents).toBe(7_500_00);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'Acme Subs', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'd', vendorName: 'Acme Subs', status: 'DRAFT' }),
        ap({ id: 'r', vendorName: 'Acme Subs', status: 'REJECTED' }),
        ap({ id: 'a', vendorName: 'Acme Subs', status: 'APPROVED' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('captures top sub + share per month', () => {
    const r = buildMonthlySubSpend({
      vendors: [
        vend({ legalName: 'Big Sub', kind: 'SUBCONTRACTOR' }),
        vend({ legalName: 'Small Sub', kind: 'SUBCONTRACTOR' }),
      ],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Big Sub', totalCents: 80_000_00 }),
        ap({ id: 'b', vendorName: 'Small Sub', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.topSubName).toBe('Big Sub');
    expect(r.rows[0]?.topSubShare).toBe(0.8);
  });

  it('counts distinct subs per month', () => {
    const r = buildMonthlySubSpend({
      vendors: [
        vend({ legalName: 'Sub A', kind: 'SUBCONTRACTOR' }),
        vend({ legalName: 'Sub B', kind: 'SUBCONTRACTOR' }),
      ],
      apInvoices: [
        ap({ id: 'a1', vendorName: 'Sub A', totalCents: 1_000_00 }),
        ap({ id: 'a2', vendorName: 'Sub A', totalCents: 1_000_00 }),
        ap({ id: 'b', vendorName: 'Sub B', totalCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.distinctSubs).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildMonthlySubSpend({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      vendors: [vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'jan', vendorName: 'Acme', invoiceDate: '2026-01-15' }),
        ap({ id: 'mar', vendorName: 'Acme', invoiceDate: '2026-03-15' }),
        ap({ id: 'apr', vendorName: 'Acme', invoiceDate: '2026-04-15' }),
        ap({ id: 'may', vendorName: 'Acme', invoiceDate: '2026-05-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(2);
  });

  it('captures peak month + spend', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme', invoiceDate: '2026-03-15', totalCents: 10_000_00 }),
        ap({ id: 'b', vendorName: 'Acme', invoiceDate: '2026-04-15', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.peakMonth).toBe('2026-04');
    expect(r.rollup.peakSpendCents).toBe(50_000_00);
  });

  it('computes month-over-month delta', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme', invoiceDate: '2026-03-15', totalCents: 30_000_00 }),
        ap({ id: 'b', vendorName: 'Acme', invoiceDate: '2026-04-15', totalCents: 40_000_00 }),
      ],
    });
    expect(r.rollup.monthOverMonthChangeCents).toBe(10_000_00);
  });

  it('sorts rows by month asc', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'Acme', kind: 'SUBCONTRACTOR' })],
      apInvoices: [
        ap({ id: 'late', vendorName: 'Acme', invoiceDate: '2026-04-15' }),
        ap({ id: 'early', vendorName: 'Acme', invoiceDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
    expect(r.rows[1]?.month).toBe('2026-04');
  });

  it('handles no sub spend in window', () => {
    const r = buildMonthlySubSpend({
      vendors: [vend({ legalName: 'Material Co', kind: 'SUPPLIER' })],
      apInvoices: [ap({ vendorName: 'Material Co' })],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakMonth).toBe(null);
  });
});
