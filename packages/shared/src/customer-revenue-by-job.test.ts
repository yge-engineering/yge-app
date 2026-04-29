import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerRevenueByJob } from './customer-revenue-by-job';

function inv(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    customerName: 'CAL FIRE',
    invoiceDate: '2026-04-15',
    invoiceNumber: '1',
    lineItems: [],
    totalCents: 100_000_00,
    status: 'SENT',
    source: 'MANUAL',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerRevenueByJob', () => {
  it('groups by (customer, job)', () => {
    const r = buildCustomerRevenueByJob({
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1' }),
        inv({ id: 'b', customerName: 'CAL FIRE', jobId: 'j2' }),
        inv({ id: 'c', customerName: 'Caltrans', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums totalCents per (customer, job)', () => {
    const r = buildCustomerRevenueByJob({
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1', totalCents: 30_000_00 }),
        inv({ id: 'b', customerName: 'CAL FIRE', jobId: 'j1', totalCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.invoiceCount).toBe(2);
  });

  it('case-folds customer name when grouping', () => {
    const r = buildCustomerRevenueByJob({
      arInvoices: [
        inv({ id: 'a', customerName: 'CAL FIRE', jobId: 'j1', totalCents: 10_000_00 }),
        inv({ id: 'b', customerName: 'cal fire', jobId: 'j1', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalCents).toBe(30_000_00);
  });

  it('tracks first + last invoice date per row', () => {
    const r = buildCustomerRevenueByJob({
      arInvoices: [
        inv({ id: 'a', invoiceDate: '2026-04-10' }),
        inv({ id: 'b', invoiceDate: '2026-04-20' }),
        inv({ id: 'c', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.firstInvoiceDate).toBe('2026-04-10');
    expect(r.rows[0]?.lastInvoiceDate).toBe('2026-04-20');
  });

  it('respects fromDate / toDate', () => {
    const r = buildCustomerRevenueByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        inv({ id: 'old', invoiceDate: '2026-03-15' }),
        inv({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalInvoices).toBe(1);
  });

  it('sorts by customerName asc, totalCents desc within customer', () => {
    const r = buildCustomerRevenueByJob({
      arInvoices: [
        inv({ id: 'a', customerName: 'Z', jobId: 'j1', totalCents: 10_000_00 }),
        inv({ id: 'b', customerName: 'A', jobId: 'small', totalCents: 5_000_00 }),
        inv({ id: 'c', customerName: 'A', jobId: 'big', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A');
    expect(r.rows[0]?.jobId).toBe('big');
    expect(r.rows[2]?.customerName).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildCustomerRevenueByJob({ arInvoices: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCents).toBe(0);
  });
});
