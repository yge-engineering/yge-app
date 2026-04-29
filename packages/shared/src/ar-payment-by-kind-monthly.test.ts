import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildArPaymentByKindMonthly } from './ar-payment-by-kind-monthly';

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

describe('buildArPaymentByKindMonthly', () => {
  it('groups by (month, kind)', () => {
    const r = buildArPaymentByKindMonthly({
      arPayments: [
        arp({ id: 'a', kind: 'PROGRESS', receivedOn: '2026-04-15' }),
        arp({ id: 'b', kind: 'RETENTION_RELEASE', receivedOn: '2026-04-15' }),
        arp({ id: 'c', kind: 'PROGRESS', receivedOn: '2026-03-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums count and cents', () => {
    const r = buildArPaymentByKindMonthly({
      arPayments: [
        arp({ id: 'a', amountCents: 30_000_00 }),
        arp({ id: 'b', amountCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.count).toBe(2);
    expect(r.rows[0]?.totalCents).toBe(50_000_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildArPaymentByKindMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by month asc, kind asc', () => {
    const r = buildArPaymentByKindMonthly({
      arPayments: [
        arp({ id: 'a', kind: 'PROGRESS', receivedOn: '2026-04-15' }),
        arp({ id: 'b', kind: 'FINAL', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('FINAL');
  });

  it('handles empty input', () => {
    const r = buildArPaymentByKindMonthly({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
