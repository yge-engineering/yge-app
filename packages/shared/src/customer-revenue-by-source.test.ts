import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerRevenueBySource } from './customer-revenue-by-source';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    invoiceNumber: '1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    totalCents: 100_000_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerRevenueBySource', () => {
  it('groups by (customer, source)', () => {
    const r = buildCustomerRevenueBySource({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', source: 'PROGRESS' }),
        ar({ id: 'b', customerName: 'A', source: 'MANUAL' }),
        ar({ id: 'c', customerName: 'B', source: 'PROGRESS' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents per pair', () => {
    const r = buildCustomerRevenueBySource({
      arInvoices: [
        ar({ id: 'a', totalCents: 30_000_00 }),
        ar({ id: 'b', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
  });

  it('canonicalizes customer name', () => {
    const r = buildCustomerRevenueBySource({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('sorts by customer asc, then totalCents desc within customer', () => {
    const r = buildCustomerRevenueBySource({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', source: 'PROGRESS', totalCents: 50_000_00 }),
        ar({ id: 'b', customerName: 'A', source: 'MANUAL', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.source).toBe('MANUAL');
    expect(r.rows[1]?.source).toBe('PROGRESS');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildCustomerRevenueBySource({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCents).toBe(100_000_00);
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueBySource({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
