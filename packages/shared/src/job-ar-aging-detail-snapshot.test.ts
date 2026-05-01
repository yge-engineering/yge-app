import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildJobArAgingDetailSnapshot } from './job-ar-aging-detail-snapshot';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    customerName: 'Caltrans',
    invoiceNumber: 'INV-001',
    invoiceDate: '2026-04-15',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildJobArAgingDetailSnapshot', () => {
  it('returns one row per unpaid invoice sorted by age desc', () => {
    const r = buildJobArAgingDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      arInvoices: [
        ar({ id: 'a', jobId: 'j1', invoiceDate: '2026-04-20', totalCents: 50_000_00, paidCents: 0 }),  // 10d
        ar({ id: 'b', jobId: 'j1', invoiceDate: '2026-03-15', totalCents: 25_000_00, paidCents: 0 }),  // 46d
        ar({ id: 'c', jobId: 'j1', invoiceDate: '2025-12-01', totalCents: 5_000_00, paidCents: 0 }),   // 150d
        ar({ id: 'd', jobId: 'j1', totalCents: 5_000_00, paidCents: 5_000_00, status: 'PAID' }),       // excluded
        ar({ id: 'e', jobId: 'j2', totalCents: 999_99, paidCents: 0 }),                                // wrong job
      ],
    });
    expect(r.rows.length).toBe(3);
    expect(r.rows[0]?.invoiceId).toBe('c');
    expect(r.rows[0]?.bucket).toBe('91+');
    expect(r.rows[0]?.ageDays).toBe(150);
    expect(r.rows[1]?.invoiceId).toBe('b');
    expect(r.rows[1]?.bucket).toBe('31-60');
    expect(r.rows[2]?.invoiceId).toBe('a');
    expect(r.rows[2]?.bucket).toBe('0-30');
    expect(r.totalOutstandingCents).toBe(80_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobArAgingDetailSnapshot({ jobId: 'X', arInvoices: [] });
    expect(r.rows.length).toBe(0);
    expect(r.totalOutstandingCents).toBe(0);
  });
});
