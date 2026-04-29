import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildArPaymentByDayOfWeek } from './ar-payment-by-day-of-week';

function arp(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 100_000_00,
    payerName: 'CAL FIRE',
    ...over,
  } as ArPayment;
}

describe('buildArPaymentByDayOfWeek', () => {
  it('groups by UTC day of week (2026-04-15 = Wednesday)', () => {
    const r = buildArPaymentByDayOfWeek({
      arPayments: [arp({ receivedOn: '2026-04-15' })],
    });
    expect(r.rows[0]?.label).toBe('Wednesday');
  });

  it('counts and sums cents per day', () => {
    const r = buildArPaymentByDayOfWeek({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-04-15', amountCents: 50_000_00 }),
        arp({ id: 'b', receivedOn: '2026-04-15', amountCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.count).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(80_000_00);
  });

  it('counts distinct customers (canonicalized)', () => {
    const r = buildArPaymentByDayOfWeek({
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE' }),
        arp({ id: 'b', payerName: 'Cal Fire, Inc.' }),
        arp({ id: 'c', payerName: 'BLM' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
  });

  it('sorts Mon-first', () => {
    const r = buildArPaymentByDayOfWeek({
      arPayments: [
        arp({ id: 'sun', receivedOn: '2026-04-19' }),
        arp({ id: 'mon', receivedOn: '2026-04-13' }),
      ],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Sunday']);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildArPaymentByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      arPayments: [
        arp({ id: 'old', receivedOn: '2026-04-13' }),
        arp({ id: 'in', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.total).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildArPaymentByDayOfWeek({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
