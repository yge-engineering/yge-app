import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildPortfolioVendorPaymentSnapshot } from './portfolio-vendor-payment-snapshot';

function pay(over: Partial<ApPayment>): ApPayment {
  return {
    id: 'app-1',
    createdAt: '',
    updatedAt: '',
    apInvoiceId: 'apinv-1',
    vendorName: 'Acme Concrete LLC',
    method: 'CHECK',
    paidOn: '2026-04-15',
    amountCents: 50_000_00,
    cleared: false,
    voided: false,
    ...over,
  } as ApPayment;
}

describe('buildPortfolioVendorPaymentSnapshot', () => {
  it('counts payments + ytd', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      apPayments: [
        pay({ id: 'a', paidOn: '2025-04-15', amountCents: 100_000_00 }),
        pay({ id: 'b', paidOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.totalPayments).toBe(2);
    expect(r.totalCents).toBe(150_000_00);
    expect(r.ytdPayments).toBe(1);
    expect(r.ytdCents).toBe(50_000_00);
  });

  it('separates cleared vs scheduled', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', amountCents: 30_000_00, cleared: true }),
        pay({ id: 'b', amountCents: 20_000_00, cleared: false }),
      ],
    });
    expect(r.clearedCents).toBe(30_000_00);
    expect(r.scheduledCents).toBe(20_000_00);
  });

  it('excludes voided from totals + counts them', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', amountCents: 50_000_00, voided: false }),
        pay({ id: 'b', amountCents: 99_999_00, voided: true }),
      ],
    });
    expect(r.totalCents).toBe(50_000_00);
    expect(r.voidedCount).toBe(1);
  });

  it('canonicalizes vendor names', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', vendorName: 'Acme Concrete LLC' }),
        pay({ id: 'b', vendorName: 'ACME CONCRETE INC' }),
        pay({ id: 'c', vendorName: 'Olson Iron' }),
      ],
    });
    expect(r.distinctVendors).toBe(2);
  });

  it('breaks down by method', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      apPayments: [
        pay({ id: 'a', method: 'CHECK' }),
        pay({ id: 'b', method: 'ACH' }),
        pay({ id: 'c', method: 'WIRE' }),
      ],
    });
    expect(r.byMethod.CHECK).toBe(1);
    expect(r.byMethod.ACH).toBe(1);
    expect(r.byMethod.WIRE).toBe(1);
  });

  it('ignores payments after asOf', () => {
    const r = buildPortfolioVendorPaymentSnapshot({
      asOf: '2026-04-30',
      apPayments: [pay({ id: 'late', paidOn: '2026-05-15' })],
    });
    expect(r.totalPayments).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioVendorPaymentSnapshot({ apPayments: [] });
    expect(r.totalPayments).toBe(0);
  });
});
