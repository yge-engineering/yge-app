import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerRevenueByMonth } from './customer-revenue-by-month';

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

describe('buildCustomerRevenueByMonth', () => {
  it('groups by (customer, month) pair', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', invoiceDate: '2026-03-15' }),
        ar({ id: 'b', customerName: 'A', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', customerName: 'B', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents per pair', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', totalCents: 30_000_00 }),
        ar({ id: 'b', customerName: 'A', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(80_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('canonicalizes customer name (groups variants together)', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
      ],
    });
    expect(r.rollup.customersConsidered).toBe(1);
  });

  it('counts distinct jobs per pair', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', jobId: 'j1' }),
        ar({ id: 'b', customerName: 'A', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildCustomerRevenueByMonth({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arInvoices: [
        ar({ id: 'mar', invoiceDate: '2026-03-15' }),
        ar({ id: 'apr', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by customer asc, then month asc', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'Z', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', customerName: 'A', invoiceDate: '2026-04-15' }),
        ar({ id: 'c', customerName: 'A', invoiceDate: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[1]?.month).toBe('2026-04');
  });

  it('rolls up portfolio totals', () => {
    const r = buildCustomerRevenueByMonth({
      arInvoices: [
        ar({ id: 'a', customerName: 'A', totalCents: 30_000_00 }),
        ar({ id: 'b', customerName: 'B', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rollup.totalCents).toBe(100_000_00);
    expect(r.rollup.customersConsidered).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueByMonth({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
  });
});
