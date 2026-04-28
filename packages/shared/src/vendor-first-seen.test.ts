import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorFirstSeen } from './vendor-first-seen';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    vendorName: 'Acme Supply',
    invoiceDate: '2026-04-01',
    lineItems: [],
    totalCents: 100_00,
    paidCents: 0,
    status: 'APPROVED',
    ...over,
  } as ApInvoice;
}

describe('buildVendorFirstSeen', () => {
  it('groups invoices by canonicalized vendor name', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Acme Supply' }),
        ap({ id: 'b', vendorName: 'ACME SUPPLY, INC.' }),
        ap({ id: 'c', vendorName: 'acme supply co' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.invoiceCount).toBe(3);
  });

  it('captures firstSeenDate from earliest invoiceDate', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'late', invoiceDate: '2026-04-15' }),
        ap({ id: 'early', invoiceDate: '2026-01-10' }),
        ap({ id: 'mid', invoiceDate: '2026-03-01' }),
      ],
    });
    expect(r.rows[0]?.firstSeenDate).toBe('2026-01-10');
    expect(r.rows[0]?.firstInvoiceId).toBe('early');
  });

  it('computes spanDays from first to last invoice', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'a', invoiceDate: '2026-01-01' }),
        ap({ id: 'b', invoiceDate: '2026-02-01' }), // 31 days later
      ],
    });
    expect(r.rows[0]?.spanDays).toBe(31);
  });

  it('skips DRAFT and REJECTED invoices', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'd', vendorName: 'Vendor A', status: 'DRAFT', invoiceDate: '2026-01-01' }),
        ap({ id: 'r', vendorName: 'Vendor B', status: 'REJECTED', invoiceDate: '2026-01-01' }),
        ap({ id: 'a', vendorName: 'Vendor C', status: 'APPROVED', invoiceDate: '2026-01-01' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.vendorName).toBe('Vendor C');
  });

  it('flags new vendors using firstSeenAfter', () => {
    const r = buildVendorFirstSeen({
      firstSeenAfter: '2026-04-01',
      apInvoices: [
        ap({ id: 'old', vendorName: 'Old Vendor', invoiceDate: '2026-01-15' }),
        ap({ id: 'new1', vendorName: 'New Vendor 1', invoiceDate: '2026-04-15' }),
        ap({ id: 'new2', vendorName: 'New Vendor 2', invoiceDate: '2026-04-20' }),
      ],
    });
    expect(r.rollup.newVendorsInWindow).toBe(2);
    expect(r.rollup.vendorsConsidered).toBe(3);
  });

  it('sums totalBilledCents per vendor', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'a', totalCents: 100_00 }),
        ap({ id: 'b', totalCents: 250_00 }),
        ap({ id: 'c', totalCents: 75_00 }),
      ],
    });
    expect(r.rows[0]?.totalBilledCents).toBe(425_00);
  });

  it('sorts rows by firstSeenDate desc (newest first)', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'a', vendorName: 'Old Vendor', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', vendorName: 'New Vendor', invoiceDate: '2026-04-15' }),
        ap({ id: 'c', vendorName: 'Mid Vendor', invoiceDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('New Vendor');
    expect(r.rows[1]?.vendorName).toBe('Mid Vendor');
    expect(r.rows[2]?.vendorName).toBe('Old Vendor');
  });

  it('captures oldest + newest first-seen in rollup', () => {
    const r = buildVendorFirstSeen({
      apInvoices: [
        ap({ id: 'a', vendorName: 'V1', invoiceDate: '2026-01-15' }),
        ap({ id: 'b', vendorName: 'V2', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.oldestFirstSeen).toBe('2026-01-15');
    expect(r.rollup.newestFirstSeen).toBe('2026-04-15');
  });

  it('handles empty input', () => {
    const r = buildVendorFirstSeen({ apInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.oldestFirstSeen).toBe(null);
  });
});
