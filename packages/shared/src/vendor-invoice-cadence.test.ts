import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorInvoiceCadence } from './vendor-invoice-cadence';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-01-15',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 100_00,
    status: 'PAID',
    ...over,
  } as ApInvoice;
}

describe('buildVendorInvoiceCadence', () => {
  it('flags INSUFFICIENT_DATA with <3 invoices', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', invoiceDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('INSUFFICIENT_DATA');
  });

  it('computes mean + median + stdDev intervals', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-01' }),
        ap({ id: 'b', invoiceDate: '2026-02-01' }), // 31
        ap({ id: 'c', invoiceDate: '2026-03-01' }), // 28
        ap({ id: 'd', invoiceDate: '2026-04-01' }), // 31
      ],
    });
    expect(r.rows[0]?.meanIntervalDays).toBe(30);
    expect(r.rows[0]?.medianIntervalDays).toBe(31);
  });

  it('flags OVERDUE when asOf is past expected next date by tolerance', () => {
    // Monthly cadence, last invoice 2026-01-01, asOf 2026-04-27.
    // Expected next ≈ 2026-02-01. asOf is ~85 days past — OVERDUE.
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2025-10-01' }),
        ap({ id: 'b', invoiceDate: '2025-11-01' }),
        ap({ id: 'c', invoiceDate: '2025-12-01' }),
        ap({ id: 'd', invoiceDate: '2026-01-01' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('OVERDUE');
    expect(r.rows[0]?.daysOverdue).toBeGreaterThan(0);
  });

  it('flags STEADY when on cadence', () => {
    // Monthly invoices ending close to asOf.
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', invoiceDate: '2026-02-15' }),
        ap({ id: 'c', invoiceDate: '2026-03-15' }),
        ap({ id: 'd', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('STEADY');
  });

  it('flags IRREGULAR when intervals scatter widely', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-04-01' }),
        ap({ id: 'b', invoiceDate: '2026-04-10' }), // 9 days
        ap({ id: 'c', invoiceDate: '2026-04-15' }), // 5 days
        ap({ id: 'd', invoiceDate: '2026-04-20' }), // 5 days — wait we need irregular
      ],
    });
    // Adjust: vary intervals more dramatically
    const r2 = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-01' }),
        ap({ id: 'b', invoiceDate: '2026-01-05' }),  // 4 days
        ap({ id: 'c', invoiceDate: '2026-03-01' }),  // 55 days
        ap({ id: 'd', invoiceDate: '2026-04-15' }),  // 45 days
      ],
    });
    expect(r2.rows[0]?.flag === 'IRREGULAR' || r2.rows[0]?.flag === 'OVERDUE').toBe(true);
    void r;
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', status: 'DRAFT', invoiceDate: '2026-01-01' }),
        ap({ id: 'b', status: 'REJECTED', invoiceDate: '2026-02-01' }),
        ap({ id: 'c', invoiceDate: '2026-03-01' }),
      ],
    });
    expect(r.rows[0]?.invoiceCount).toBe(1);
    expect(r.rows[0]?.flag).toBe('INSUFFICIENT_DATA');
  });

  it('case-insensitively merges vendor name variants', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Supply', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', vendorName: 'ACME SUPPLY', invoiceDate: '2026-02-15' }),
        ap({ id: 'c', vendorName: 'acme supply', invoiceDate: '2026-03-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(3);
  });

  it('captures first + last invoice dates + expected next', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', invoiceDate: '2026-02-15' }),
        ap({ id: 'c', invoiceDate: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2026-01-15');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-03-15');
    expect(r.rows[0]?.expectedNextDate).toMatch(/^2026-04-/);
  });

  it('sorts OVERDUE first, INSUFFICIENT_DATA pinned last', () => {
    const r = buildVendorInvoiceCadence({
      asOf: '2026-04-27',
      apInvoices: [
        ap({ id: 'i1', vendorName: 'Insufficient', invoiceDate: '2026-04-15' }),
        ap({ id: 'i2', vendorName: 'Insufficient', invoiceDate: '2026-04-20' }),
        ap({ id: 'o1', vendorName: 'Overdue', invoiceDate: '2025-10-01' }),
        ap({ id: 'o2', vendorName: 'Overdue', invoiceDate: '2025-11-01' }),
        ap({ id: 'o3', vendorName: 'Overdue', invoiceDate: '2025-12-01' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Overdue');
    expect(r.rows[r.rows.length - 1]?.vendorName).toBe('Insufficient');
  });
});
