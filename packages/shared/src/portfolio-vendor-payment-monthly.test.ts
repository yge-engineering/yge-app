import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildPortfolioVendorPaymentMonthly } from './portfolio-vendor-payment-monthly';

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'ap-1',
    vendorName: 'V',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioVendorPaymentMonthly', () => {
  it('splits cents by method', () => {
    const r = buildPortfolioVendorPaymentMonthly({
      apPayments: [
        app({ id: 'a', method: 'CHECK', amountCents: 50_000_00 }),
        app({ id: 'b', method: 'ACH', amountCents: 30_000_00 }),
        app({ id: 'c', method: 'WIRE', amountCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.checkCents).toBe(50_000_00);
    expect(r.rows[0]?.achCents).toBe(30_000_00);
    expect(r.rows[0]?.wireCents).toBe(10_000_00);
  });

  it('skips voided payments', () => {
    const r = buildPortfolioVendorPaymentMonthly({
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.voidedSkipped).toBe(1);
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('counts distinct vendors with canonicalization', () => {
    const r = buildPortfolioVendorPaymentMonthly({
      apPayments: [
        app({ id: 'a', vendorName: 'Granite' }),
        app({ id: 'b', vendorName: 'Granite, Inc' }),
        app({ id: 'c', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioVendorPaymentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      apPayments: [
        app({ id: 'old', paidOn: '2026-03-15' }),
        app({ id: 'in', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioVendorPaymentMonthly({
      apPayments: [
        app({ id: 'a', paidOn: '2026-06-15' }),
        app({ id: 'b', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorPaymentMonthly({ apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
