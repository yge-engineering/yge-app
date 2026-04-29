import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildApPaymentMonthly } from './ap-payment-monthly';

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildApPaymentMonthly', () => {
  it('buckets by yyyy-mm of paidOn', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'a', paidOn: '2026-03-15' }),
        app({ id: 'b', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('skips voided payments', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts cleared vs uncleared per month', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'a', cleared: true, amountCents: 30_000_00 }),
        app({ id: 'b', cleared: false, amountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.cleared).toBe(1);
    expect(r.rows[0]?.clearedCents).toBe(30_000_00);
    expect(r.rows[0]?.uncleared).toBe(1);
    expect(r.rows[0]?.unclearedCents).toBe(70_000_00);
  });

  it('breaks down by method', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'a', method: 'CHECK' }),
        app({ id: 'b', method: 'CHECK' }),
        app({ id: 'c', method: 'ACH' }),
      ],
    });
    expect(r.rows[0]?.byMethod.CHECK).toBe(2);
    expect(r.rows[0]?.byMethod.ACH).toBe(1);
  });

  it('counts distinct vendors per month (canonicalized)', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'a', vendorName: 'Granite Construction Co' }),
        app({ id: 'b', vendorName: 'GRANITE CONSTRUCTION, INC.' }),
        app({ id: 'c', vendorName: 'CalPortland' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildApPaymentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apPayments: [
        app({ id: 'mar', paidOn: '2026-03-15' }),
        app({ id: 'apr', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'a', amountCents: 10_000_00 }),
        app({ id: 'b', amountCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(2);
    expect(r.rollup.totalAmountCents).toBe(30_000_00);
  });

  it('sorts by month asc', () => {
    const r = buildApPaymentMonthly({
      apPayments: [
        app({ id: 'late', paidOn: '2026-04-15' }),
        app({ id: 'early', paidOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildApPaymentMonthly({ apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
