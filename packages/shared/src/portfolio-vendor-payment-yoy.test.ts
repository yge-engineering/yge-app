import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildPortfolioVendorPaymentYoy } from './portfolio-vendor-payment-yoy';

function app(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildPortfolioVendorPaymentYoy', () => {
  it('compares prior vs current totals + delta', () => {
    const r = buildPortfolioVendorPaymentYoy({
      currentYear: 2026,
      apPayments: [
        app({ id: 'a', paidOn: '2025-04-15', amountCents: 30_000_00 }),
        app({ id: 'b', paidOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.priorTotalCents).toBe(30_000_00);
    expect(r.currentTotalCents).toBe(50_000_00);
    expect(r.totalCentsDelta).toBe(20_000_00);
  });

  it('breaks down by method', () => {
    const r = buildPortfolioVendorPaymentYoy({
      currentYear: 2026,
      apPayments: [
        app({ id: 'a', method: 'CHECK' }),
        app({ id: 'b', method: 'ACH' }),
        app({ id: 'c', method: 'CHECK' }),
      ],
    });
    expect(r.currentByMethod.CHECK).toBe(2);
    expect(r.currentByMethod.ACH).toBe(1);
  });

  it('skips voided', () => {
    const r = buildPortfolioVendorPaymentYoy({
      currentYear: 2026,
      apPayments: [
        app({ id: 'a' }),
        app({ id: 'b', voided: true }),
      ],
    });
    expect(r.voidedSkipped).toBe(1);
    expect(r.currentTotalPayments).toBe(1);
  });

  it('counts distinct vendors with canonicalization', () => {
    const r = buildPortfolioVendorPaymentYoy({
      currentYear: 2026,
      apPayments: [
        app({ id: 'a', vendorName: 'Granite' }),
        app({ id: 'b', vendorName: 'Granite, Inc' }),
        app({ id: 'c', vendorName: 'Bob Trucking' }),
      ],
    });
    expect(r.currentDistinctVendors).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorPaymentYoy({ currentYear: 2026, apPayments: [] });
    expect(r.currentTotalCents).toBe(0);
  });
});
