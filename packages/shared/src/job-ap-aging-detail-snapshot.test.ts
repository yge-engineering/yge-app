import { describe, expect, it } from 'vitest';

import type { ApInvoice } from './ap-invoice';

import { buildJobApAgingDetailSnapshot } from './job-ap-aging-detail-snapshot';

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

describe('buildJobApAgingDetailSnapshot', () => {
  it('returns one row per unpaid invoice sorted by age desc', () => {
    const r = buildJobApAgingDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      apInvoices: [
        ap({ id: 'a', jobId: 'j1', vendorName: 'Granite', invoiceDate: '2026-04-20', totalCents: 50_000_00 }),  // 10d
        ap({ id: 'b', jobId: 'j1', vendorName: 'Other', invoiceDate: '2026-03-15', totalCents: 25_000_00 }),    // 46d
        ap({ id: 'c', jobId: 'j1', vendorName: 'Granite', invoiceDate: '2025-12-01', totalCents: 5_000_00 }),   // 150d
        ap({ id: 'd', jobId: 'j1', totalCents: 5_000_00, paidCents: 5_000_00, status: 'PAID' }),                // excluded
        ap({ id: 'e', jobId: 'j2', totalCents: 999_99 }),                                                       // wrong job
      ],
    });
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]?.invoiceId).toBe('c');
    expect(r.rows[0]?.bucket).toBe('91+');
    expect(r.rows[1]?.invoiceId).toBe('b');
    expect(r.rows[1]?.bucket).toBe('31-60');
    expect(r.rows[2]?.invoiceId).toBe('a');
    expect(r.rows[2]?.bucket).toBe('0-30');
    expect(r.totalOutstandingCents).toBe(80_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobApAgingDetailSnapshot({ jobId: 'X', apInvoices: [] });
    expect(r.rows.length).toBe(0);
    expect(r.totalOutstandingCents).toBe(0);
  });
});
