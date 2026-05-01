import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorApAgingDetailSnapshot } from './vendor-ap-aging-detail-snapshot';

function ap(over: Partial<ApInvoice>): ApInvoice {
  return {
    id: 'ap-1',
    createdAt: '',
    updatedAt: '',
    vendorName: 'Granite',
    invoiceDate: '2026-04-15',
    jobId: 'j1',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'PENDING',
    ...over,
  } as ApInvoice;
}

describe('buildVendorApAgingDetailSnapshot', () => {
  it('buckets unpaid invoices by age', () => {
    const r = buildVendorApAgingDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1', invoiceDate: '2026-04-20', totalCents: 50_000_00, paidCents: 0 }),  // 10d
        ap({ id: 'b', vendorName: 'GRANITE LLC', jobId: 'j1', invoiceDate: '2026-03-15', totalCents: 25_000_00, paidCents: 0 }),  // 46d
        ap({ id: 'c', vendorName: 'Granite Inc.', jobId: 'j1', invoiceDate: '2026-02-01', totalCents: 10_000_00, paidCents: 0 }),  // 88d
        ap({ id: 'd', vendorName: 'Granite', jobId: 'j1', invoiceDate: '2025-12-01', totalCents: 5_000_00, paidCents: 0 }),       // 150d
        ap({ id: 'e', vendorName: 'Granite', jobId: 'j1', invoiceDate: '2026-04-25', totalCents: 5_000_00, paidCents: 5_000_00, status: 'PAID' }), // excluded
        ap({ id: 'f', vendorName: 'Other', jobId: 'j1', totalCents: 999_99 }),
        ap({ id: 'g', vendorName: 'Granite', jobId: 'j2', invoiceDate: '2026-04-25', totalCents: 30_000_00, paidCents: 0 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.bucket0to30Cents).toBe(50_000_00);
    expect(r.rows[0]?.bucket31to60Cents).toBe(25_000_00);
    expect(r.rows[0]?.bucket61to90Cents).toBe(10_000_00);
    expect(r.rows[0]?.bucket91plusCents).toBe(5_000_00);
    expect(r.rows[0]?.totalOutstandingCents).toBe(90_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(4);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.bucket0to30Cents).toBe(30_000_00);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorApAgingDetailSnapshot({ vendorName: 'X', apInvoices: [] });
    expect(r.rows.length).toBe(0);
  });
});
