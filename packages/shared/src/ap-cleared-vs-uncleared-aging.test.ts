import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildApClearedVsUnclearedAging } from './ap-cleared-vs-uncleared-aging';

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

describe('buildApClearedVsUnclearedAging', () => {
  it('buckets by days since paidOn', () => {
    const r = buildApClearedVsUnclearedAging({
      asOf: '2026-04-28',
      apPayments: [
        app({ id: 'cur', paidOn: '2026-04-28' }),
        app({ id: '10', paidOn: '2026-04-18' }),
        app({ id: '20', paidOn: '2026-04-08' }),
        app({ id: '50', paidOn: '2026-03-09' }),
        app({ id: '120', paidOn: '2025-12-29' }),
      ],
    });
    expect(r.rows.find((x) => x.bucket === 'CURRENT')?.unclearedCount).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_1_15')?.unclearedCount).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_16_30')?.unclearedCount).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_31_60')?.unclearedCount).toBe(1);
    expect(r.rows.find((x) => x.bucket === 'PAST_60_PLUS')?.unclearedCount).toBe(1);
  });

  it('separates cleared from uncleared', () => {
    const r = buildApClearedVsUnclearedAging({
      asOf: '2026-04-28',
      apPayments: [
        app({ id: 'a', paidOn: '2026-04-15', cleared: true, amountCents: 30_000_00 }),
        app({ id: 'b', paidOn: '2026-04-15', cleared: false, amountCents: 70_000_00 }),
      ],
    });
    const past = r.rows.find((x) => x.bucket === 'PAST_1_15');
    expect(past?.clearedCents).toBe(30_000_00);
    expect(past?.unclearedCents).toBe(70_000_00);
  });

  it('skips voided payments', () => {
    const r = buildApClearedVsUnclearedAging({
      asOf: '2026-04-28',
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.paymentsConsidered).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('returns five buckets in fixed order', () => {
    const r = buildApClearedVsUnclearedAging({
      asOf: '2026-04-28',
      apPayments: [app({})],
    });
    expect(r.rows.map((x) => x.bucket)).toEqual([
      'CURRENT', 'PAST_1_15', 'PAST_16_30', 'PAST_31_60', 'PAST_60_PLUS',
    ]);
  });

  it('rolls up totals', () => {
    const r = buildApClearedVsUnclearedAging({
      asOf: '2026-04-28',
      apPayments: [
        app({ id: 'a', cleared: true, amountCents: 30_000_00 }),
        app({ id: 'b', cleared: false, amountCents: 70_000_00 }),
      ],
    });
    expect(r.rollup.totalClearedCents).toBe(30_000_00);
    expect(r.rollup.totalUnclearedCents).toBe(70_000_00);
  });

  it('handles empty input', () => {
    const r = buildApClearedVsUnclearedAging({ apPayments: [] });
    expect(r.rollup.paymentsConsidered).toBe(0);
  });
});
