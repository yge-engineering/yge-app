import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildArPaymentMonthly } from './ar-payment-monthly';

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

describe('buildArPaymentMonthly', () => {
  it('buckets by yyyy-mm of receivedOn', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-03-15' }),
        arp({ id: 'b', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums totalAmountCents per month', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'a', amountCents: 30_000_00 }),
        arp({ id: 'b', amountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(100_000_00);
  });

  it('breaks down by method', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'a', method: 'CHECK' }),
        arp({ id: 'b', method: 'CHECK' }),
        arp({ id: 'c', method: 'WIRE' }),
      ],
    });
    expect(r.rows[0]?.byMethod.CHECK).toBe(2);
    expect(r.rows[0]?.byMethod.WIRE).toBe(1);
  });

  it('breaks down by kind', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'a', kind: 'PROGRESS' }),
        arp({ id: 'b', kind: 'RETENTION_RELEASE' }),
        arp({ id: 'c', kind: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byKind.PROGRESS).toBe(2);
    expect(r.rows[0]?.byKind.RETENTION_RELEASE).toBe(1);
  });

  it('counts distinct customers + jobs per month', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'a', payerName: 'CAL FIRE', jobId: 'j1' }),
        arp({ id: 'b', payerName: 'Cal Fire, Inc.', jobId: 'j1' }),
        arp({ id: 'c', payerName: 'BLM', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctCustomers).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildArPaymentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15' }),
        arp({ id: 'apr', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month amount change', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'mar', receivedOn: '2026-03-15', amountCents: 10_000_00 }),
        arp({ id: 'apr', receivedOn: '2026-04-15', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.monthOverMonthAmountChange).toBe(40_000_00);
  });

  it('sorts by month asc', () => {
    const r = buildArPaymentMonthly({
      arPayments: [
        arp({ id: 'late', receivedOn: '2026-04-15' }),
        arp({ id: 'early', receivedOn: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildArPaymentMonthly({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
