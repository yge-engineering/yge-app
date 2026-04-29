import { describe, expect, it } from 'vitest';

import type { ApPayment } from './ap-payment';

import { buildApPaymentByDayOfWeek } from './ap-payment-by-day-of-week';

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

describe('buildApPaymentByDayOfWeek', () => {
  it('groups by day of week', () => {
    const r = buildApPaymentByDayOfWeek({
      apPayments: [app({ paidOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.label).toBe('Wednesday');
  });

  it('skips voided payments', () => {
    const r = buildApPaymentByDayOfWeek({
      apPayments: [
        app({ id: 'live' }),
        app({ id: 'gone', voided: true }),
      ],
    });
    expect(r.rollup.total).toBe(1);
    expect(r.rollup.voidedSkipped).toBe(1);
  });

  it('counts and sums cents', () => {
    const r = buildApPaymentByDayOfWeek({
      apPayments: [
        app({ id: 'a', amountCents: 30_000_00 }),
        app({ id: 'b', amountCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.count).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(50_000_00);
  });

  it('counts distinct vendors (canonicalized)', () => {
    const r = buildApPaymentByDayOfWeek({
      apPayments: [
        app({ id: 'a', vendorName: 'Granite' }),
        app({ id: 'b', vendorName: 'GRANITE, INC.' }),
        app({ id: 'c', vendorName: 'CalPortland' }),
      ],
    });
    expect(r.rows[0]?.distinctVendors).toBe(2);
  });

  it('sorts Mon-first', () => {
    const r = buildApPaymentByDayOfWeek({
      apPayments: [
        app({ id: 'sun', paidOn: '2026-04-19' }),
        app({ id: 'mon', paidOn: '2026-04-13' }),
      ],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Sunday']);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildApPaymentByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      apPayments: [
        app({ id: 'old', paidOn: '2026-04-13' }),
        app({ id: 'in', paidOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildApPaymentByDayOfWeek({ apPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
