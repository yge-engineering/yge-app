import { describe, expect, it } from 'vitest';

import type { ArInvoice } from './ar-invoice';

import { buildCustomerArAgingSummary } from './customer-ar-aging-summary';

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

describe('buildCustomerArAgingSummary', () => {
  it('buckets by days past invoiceDate or dueDate', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'cur', invoiceDate: '2026-04-28' }),
        ar({ id: '15', invoiceDate: '2026-04-13' }),
        ar({ id: '50', invoiceDate: '2026-03-09' }),
        ar({ id: '80', invoiceDate: '2026-02-07' }),
        ar({ id: '120', invoiceDate: '2025-12-29' }),
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'CURRENT')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_1_30')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_31_60')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_61_90')?.count).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_90_PLUS')?.count).toBe(1);
  });

  it('uses dueDate when set', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [ar({ invoiceDate: '2026-01-01', dueDate: '2026-04-28' })],
    });
    expect(r.rows[0]?.bucket).toBe('CURRENT');
  });

  it('skips PAID and WRITTEN_OFF invoices', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'sent', status: 'SENT' }),
        ar({ id: 'paid', status: 'PAID' }),
        ar({ id: 'wo', status: 'WRITTEN_OFF' }),
      ],
    });
    expect(r.rollup.invoicesConsidered).toBe(1);
  });

  it('uses unpaid balance', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [ar({ totalCents: 100_000_00, paidCents: 30_000_00 })],
    });
    expect(r.rollup.totalUnpaidCents).toBe(70_000_00);
  });

  it('counts distinct customers per bucket', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [
        ar({ id: 'a', customerName: 'CAL FIRE' }),
        ar({ id: 'b', customerName: 'Cal Fire, Inc.' }),
        ar({ id: 'c', customerName: 'BLM' }),
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'PAST_1_30')?.distinctCustomers).toBe(2);
  });

  it('returns five buckets in fixed order', () => {
    const r = buildCustomerArAgingSummary({
      asOf: '2026-04-28',
      arInvoices: [ar({})],
    });
    expect(r.rows.map((x) => x.bucket)).toEqual([
      'CURRENT', 'PAST_1_30', 'PAST_31_60', 'PAST_61_90', 'PAST_90_PLUS',
    ]);
  });

  it('handles empty input', () => {
    const r = buildCustomerArAgingSummary({ arInvoices: [] });
    expect(r.rollup.invoicesConsidered).toBe(0);
  });
});
