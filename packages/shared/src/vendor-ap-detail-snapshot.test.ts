import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildVendorApDetailSnapshot } from './vendor-ap-detail-snapshot';

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

describe('buildVendorApDetailSnapshot', () => {
  it('returns one row per job sorted by outstanding', () => {
    const r = buildVendorApDetailSnapshot({
      vendorName: 'Granite',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', vendorName: 'Granite', jobId: 'j1', invoiceDate: '2026-04-01', totalCents: 100_000_00, paidCents: 50_000_00 }),
        ap({ id: 'b', vendorName: 'GRANITE LLC', jobId: 'j1', invoiceDate: '2026-04-15', totalCents: 25_000_00, paidCents: 0 }),
        ap({ id: 'c', vendorName: 'Granite Inc.', jobId: 'j2', invoiceDate: '2026-04-10', totalCents: 200_000_00, paidCents: 200_000_00 }),
        ap({ id: 'd', vendorName: 'Other', jobId: 'j1', totalCents: 999_99, paidCents: 0 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.invoiceCount).toBe(2);
    expect(r.rows[0]?.billedCents).toBe(125_000_00);
    expect(r.rows[0]?.paidCents).toBe(50_000_00);
    expect(r.rows[0]?.outstandingCents).toBe(75_000_00);
    expect(r.rows[0]?.oldestUnpaidDate).toBe('2026-04-01');
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.outstandingCents).toBe(0);
  });

  it('handles unknown vendor', () => {
    const r = buildVendorApDetailSnapshot({ vendorName: 'X', apInvoices: [] });
    expect(r.rows.length).toBe(0);
  });
});
