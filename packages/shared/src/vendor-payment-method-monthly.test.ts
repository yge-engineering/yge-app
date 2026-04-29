import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildVendorPaymentMethodMonthly } from './vendor-payment-method-monthly';

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

describe('buildVendorPaymentMethodMonthly', () => {
  it('buckets by yyyy-mm of paidOn', () => {
    const r = buildVendorPaymentMethodMonthly({
      apPayments: [
        app({ id: 'a', paidOn: '2026-03-15' }),
        app({ id: 'b', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('breaks down by method count and amount', () => {
    const r = buildVendorPaymentMethodMonthly({
      apPayments: [
        app({ id: 'a', method: 'CHECK', amountCents: 30_000_00 }),
        app({ id: 'b', method: 'ACH', amountCents: 70_000_00 }),
        app({ id: 'c', method: 'CHECK', amountCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.byMethod.CHECK).toBe(2);
    expect(r.rows[0]?.checkAmountCents).toBe(40_000_00);
    expect(r.rows[0]?.achAmountCents).toBe(70_000_00);
  });

  it('skips voided payments', () => {
    const r = buildVendorPaymentMethodMonthly({
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts distinct vendors per month', () => {
    const r = buildVendorPaymentMethodMonthly({
      apPayments: [
        app({ id: 'a', vendorName: 'Granite' }),
        app({ id: 'b', vendorName: 'GRANITE, INC.' }),
        app({ id: 'c', vendorName: 'CalPortland' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildVendorPaymentMethodMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apPayments: [
        app({ id: 'mar', paidOn: '2026-03-15' }),
        app({ id: 'apr', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildVendorPaymentMethodMonthly({
      apPayments: [
        app({ id: 'late', paidOn: '2026-04-15' }),
        app({ id: 'early', paidOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildVendorPaymentMethodMonthly({ apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
