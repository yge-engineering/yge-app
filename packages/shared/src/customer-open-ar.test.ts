import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerOpenAr } from './customer-open-ar';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-01',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerOpenAr', () => {
  it('skips DRAFT, PAID, WRITTEN_OFF', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'ar-1', status: 'DRAFT' }),
        ar({ id: 'ar-2', status: 'PAID', paidCents: 100_00 }),
        ar({ id: 'ar-3', status: 'WRITTEN_OFF' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips zero-balance open invoices', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ totalCents: 100_00, paidCents: 100_00, status: 'PARTIALLY_PAID' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('case-insensitively merges customer names', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'ar-1', customerName: 'Cal Fire' }),
        ar({ id: 'ar-2', customerName: 'CAL FIRE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.openInvoiceCount).toBe(2);
  });

  it('buckets by days past effective due (invoiceDate + 30 fallback)', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        // invoiceDate 2026-04-15, no dueDate → due 2026-05-15 → not yet overdue
        ar({ id: 'fresh', invoiceDate: '2026-04-15' }),
        // invoiceDate 2026-03-15, due 2026-04-14 → 13 days overdue → 0-30
        ar({ id: 'b0', invoiceDate: '2026-03-15' }),
        // invoiceDate 2026-02-01, due 2026-03-03 → 55 days overdue → 31-60
        ar({ id: 'b31', invoiceDate: '2026-02-01' }),
        // invoiceDate 2026-01-01, due 2026-01-31 → 86 days overdue → 61-90
        ar({ id: 'b61', invoiceDate: '2026-01-01' }),
        // invoiceDate 2025-10-01, due 2025-10-31 → 178 days overdue → 90+
        ar({ id: 'b90', invoiceDate: '2025-10-01' }),
      ],
    });
    expect(r.rows[0]?.bucket0to30Count).toBe(2); // fresh + b0
    expect(r.rows[0]?.bucket31to60Count).toBe(1);
    expect(r.rows[0]?.bucket61to90Count).toBe(1);
    expect(r.rows[0]?.bucket90PlusCount).toBe(1);
  });

  it('uses explicit dueDate when set', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        // due 2026-01-15 → 102 days overdue → 90+
        ar({ invoiceDate: '2026-04-01', dueDate: '2026-01-15' }),
      ],
    });
    expect(r.rows[0]?.bucket90PlusCount).toBe(1);
  });

  it('captures oldest invoice date and daysSinceOldest', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'newer', invoiceDate: '2026-04-01' }),
        ar({ id: 'older', invoiceDate: '2026-01-15' }),
      ],
    });
    expect(r.rows[0]?.oldestInvoiceDate).toBe('2026-01-15');
    expect(r.rows[0]?.daysSinceOldest).toBe(102);
  });

  it('sets worstBucket from highest age band present', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ id: 'recent', invoiceDate: '2026-04-15' }),
        ar({ id: 'old', invoiceDate: '2025-10-01' }),
      ],
    });
    expect(r.rows[0]?.worstBucket).toBe('90+');
  });

  it('flags customers-with-danger-bucket in rollup', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ customerName: 'Slow', invoiceDate: '2025-10-01' }),
        ar({ customerName: 'Quick', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.customersWithDangerBucket).toBe(1);
  });

  it('rolls up totals across customers', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ customerName: 'A', totalCents: 100_00, paidCents: 0 }),
        ar({ customerName: 'B', totalCents: 200_00, paidCents: 50_00, status: 'PARTIALLY_PAID' }),
      ],
    });
    expect(r.rollup.totalOpenInvoices).toBe(2);
    expect(r.rollup.totalOutstandingCents).toBe(250_00);
  });

  it('sorts worst-bucket first, then by daysSinceOldest desc', () => {
    const r = buildCustomerOpenAr({
      asOf: '2026-04-27',
      arInvoices: [
        ar({ customerName: 'Recent', invoiceDate: '2026-04-15' }),  // 0-30
        ar({ customerName: 'Old1', invoiceDate: '2025-10-01' }),    // 90+
        ar({ customerName: 'Old2', invoiceDate: '2025-08-01' }),    // 90+ (older)
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Old2');
    expect(r.rows[1]?.customerName).toBe('Old1');
    expect(r.rows[2]?.customerName).toBe('Recent');
  });
});
