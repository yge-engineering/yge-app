import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildArPaymentByJobMethod } from './ar-payment-by-job-method';

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

describe('buildArPaymentByJobMethod', () => {
  it('groups by (job, method)', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', jobId: 'j1', method: 'CHECK' }),
        arp({ id: 'b', jobId: 'j1', method: 'ACH' }),
        arp({ id: 'c', jobId: 'j2', method: 'CHECK' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums amountCents and counts payments per (job, method)', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', jobId: 'j1', method: 'CHECK', amountCents: 30_000_00 }),
        arp({ id: 'b', jobId: 'j1', method: 'CHECK', amountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.amountCents).toBe(100_000_00);
    expect(r.rows[0]?.total).toBe(2);
  });

  it('computes share within job', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', jobId: 'j1', method: 'CHECK', amountCents: 75_000_00 }),
        arp({ id: 'b', jobId: 'j1', method: 'ACH', amountCents: 25_000_00 }),
      ],
    });
    const check = r.rows.find((x) => x.method === 'CHECK');
    const ach = r.rows.find((x) => x.method === 'ACH');
    expect(check?.share).toBe(0.75);
    expect(ach?.share).toBe(0.25);
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', jobId: 'j1' }),
        arp({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate', () => {
    const r = buildArPaymentByJobMethod({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        arp({ id: 'old', receivedOn: '2026-03-15' }),
        arp({ id: 'in', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('tracks last receivedOn per row', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', method: 'CHECK', receivedOn: '2026-04-10' }),
        arp({ id: 'b', method: 'CHECK', receivedOn: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastReceivedOn).toBe('2026-04-20');
  });

  it('sorts by jobId asc, amountCents desc within job', () => {
    const r = buildArPaymentByJobMethod({
      arPayments: [
        arp({ id: 'a', jobId: 'A', method: 'CHECK', amountCents: 5_000_00 }),
        arp({ id: 'b', jobId: 'A', method: 'ACH', amountCents: 100_000_00 }),
        arp({ id: 'c', jobId: 'Z', method: 'CHECK', amountCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.method).toBe('ACH');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildArPaymentByJobMethod({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalPayments).toBe(0);
  });
});
