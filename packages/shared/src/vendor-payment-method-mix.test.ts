import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildVendorPaymentMethodMix } from './vendor-payment-method-mix';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    apInvoiceId: 'ap-1',
    vendorName: 'Granite Construction Co',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildVendorPaymentMethodMix', () => {
  it('groups payments by canonicalized vendor name', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 'p1', vendorName: 'Granite Construction Co' }),
        pay({ id: 'p2', vendorName: 'GRANITE CONSTRUCTION, CO.' }),
        pay({ id: 'p3', vendorName: 'granite construction company' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.totalPayments).toBe(3);
  });

  it('breaks down by method with counts + amounts + shares', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 'p1', method: 'CHECK', amountCents: 60_000_00 }),
        pay({ id: 'p2', method: 'WIRE', amountCents: 40_000_00 }),
      ],
    });
    const row = r.rows[0];
    expect(row?.byMethod.CHECK?.amountCents).toBe(60_000_00);
    expect(row?.byMethod.CHECK?.share).toBe(0.6);
    expect(row?.byMethod.WIRE?.share).toBe(0.4);
  });

  it('captures dominant method by amount', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 'p1', method: 'WIRE', amountCents: 90_000_00 }),
        pay({ id: 'p2', method: 'CHECK', amountCents: 5_000_00 }),
        pay({ id: 'p3', method: 'CHECK', amountCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.dominantMethod).toBe('WIRE');
  });

  it('skips voided payments', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 'live', amountCents: 10_000_00 }),
        pay({ id: 'gone', amountCents: 99_000_00, voided: true }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
    expect(r.rollup.totalAmountCents).toBe(10_000_00);
  });

  it('respects fromDate/toDate window', () => {
    const r = buildVendorPaymentMethodMix({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      apPayments: [
        pay({ id: 'old', paidOn: '2026-03-15' }),
        pay({ id: 'in', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('rolls up portfolio totals + per-method amounts', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 'p1', vendorName: 'A', method: 'CHECK', amountCents: 10_000_00 }),
        pay({ id: 'p2', vendorName: 'B', method: 'WIRE', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(2);
    expect(r.rollup.totalAmountCents).toBe(60_000_00);
    expect(r.rollup.portfolioByMethod.CHECK).toBe(10_000_00);
    expect(r.rollup.portfolioByMethod.WIRE).toBe(50_000_00);
  });

  it('sorts vendors by total amount desc', () => {
    const r = buildVendorPaymentMethodMix({
      apPayments: [
        pay({ id: 's', vendorName: 'Small', amountCents: 5_000_00 }),
        pay({ id: 'b', vendorName: 'Big', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.vendorName).toBe('Big');
  });

  it('handles empty input', () => {
    const r = buildVendorPaymentMethodMix({ apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
