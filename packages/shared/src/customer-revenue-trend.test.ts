import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerRevenueTrend } from './customer-revenue-trend';

function ar(over: Partial<ArInvoice>): ArInvoice {
  return {
    id: 'ar-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    invoiceNumber: '1',
    customerName: 'Cal Fire',
    invoiceDate: '2026-04-15',
    source: 'PROGRESS',
    lineItems: [],
    subtotalCents: 100_00,
    totalCents: 100_00,
    paidCents: 0,
    status: 'SENT',
    ...over,
  } as ArInvoice;
}

describe('buildCustomerRevenueTrend', () => {
  it('skips DRAFT and WRITTEN_OFF', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'd', status: 'DRAFT' }),
        ar({ id: 'w', status: 'WRITTEN_OFF' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects window bounds', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arInvoices: [
        ar({ id: 'old', invoiceDate: '2026-03-15' }),
        ar({ id: 'in', invoiceDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.monthsWithRevenue).toBe(1);
  });

  it('groups invoices by yyyy-mm', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-04-25', totalCents: 30_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-05-01', totalCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.monthsWithRevenue).toBe(2);
    expect(r.rows[0]?.monthlyCells[0]?.yearMonth).toBe('2026-04');
    expect(r.rows[0]?.monthlyCells[0]?.billedCents).toBe(80_000_00);
    expect(r.rows[0]?.monthlyCells[1]?.yearMonth).toBe('2026-05');
  });

  it('flags INSUFFICIENT_DATA when <3 months', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-04-15' }),
        ar({ id: 'b', invoiceDate: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.direction).toBe('INSUFFICIENT_DATA');
    expect(r.rows[0]?.monthlySlopeCents).toBe(null);
  });

  it('flags GROWING when slope rises substantially', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-15', totalCents: 10_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-02-15', totalCents: 50_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-03-15', totalCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.direction).toBe('GROWING');
    expect(r.rows[0]?.monthlySlopeCents).toBeGreaterThan(0);
  });

  it('flags SHRINKING when slope drops substantially', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-15', totalCents: 100_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-02-15', totalCents: 50_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-03-15', totalCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.direction).toBe('SHRINKING');
    expect(r.rows[0]?.monthlySlopeCents).toBeLessThan(0);
  });

  it('flags STEADY when slope flat', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-15', totalCents: 50_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-02-15', totalCents: 51_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-03-15', totalCents: 49_000_00 }),
        ar({ id: 'd', invoiceDate: '2026-04-15', totalCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.direction).toBe('STEADY');
  });

  it('captures peak and trough months', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', invoiceDate: '2026-01-15', totalCents: 100_000_00 }),
        ar({ id: 'b', invoiceDate: '2026-02-15', totalCents: 50_000_00 }),
        ar({ id: 'c', invoiceDate: '2026-03-15', totalCents: 200_000_00 }),
      ],
    });
    expect(r.rows[0]?.peakMonthCents).toBe(200_000_00);
    expect(r.rows[0]?.troughMonthCents).toBe(50_000_00);
  });

  it('case-insensitively collapses customer names', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', customerName: 'Cal Fire' }),
        ar({ id: 'b', customerName: 'CAL FIRE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by total billed desc + rolls up grand total', () => {
    const r = buildCustomerRevenueTrend({
      fromDate: '2026-01-01',
      toDate: '2026-12-31',
      arInvoices: [
        ar({ id: 'a', customerName: 'Small', totalCents: 10_000_00 }),
        ar({ id: 'b', customerName: 'Big', totalCents: 500_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big');
    expect(r.rollup.totalBilledCents).toBe(510_000_00);
  });
});
