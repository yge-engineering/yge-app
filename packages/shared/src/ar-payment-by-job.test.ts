import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';

import { buildArPaymentByJob } from './ar-payment-by-job';

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

describe('buildArPaymentByJob', () => {
  it('groups by jobId', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', jobId: 'j1' }),
        arp({ id: 'b', jobId: 'j2' }),
        arp({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums cents and counts payments', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', amountCents: 30_000_00 }),
        arp({ id: 'b', amountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCents).toBe(100_000_00);
    expect(r.rows[0]?.total).toBe(2);
  });

  it('breaks down by kind', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', kind: 'PROGRESS' }),
        arp({ id: 'b', kind: 'RETENTION_RELEASE' }),
        arp({ id: 'c', kind: 'PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byKind.PROGRESS).toBe(2);
    expect(r.rows[0]?.byKind.RETENTION_RELEASE).toBe(1);
  });

  it('counts unattributed (no jobId)', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', jobId: 'j1' }),
        arp({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('tracks last receivedOn', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', receivedOn: '2026-04-10' }),
        arp({ id: 'b', receivedOn: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.lastReceivedOn).toBe('2026-04-20');
  });

  it('respects fromDate / toDate', () => {
    const r = buildArPaymentByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      arPayments: [
        arp({ id: 'old', receivedOn: '2026-03-15' }),
        arp({ id: 'in', receivedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPayments).toBe(1);
  });

  it('sorts by totalCents desc', () => {
    const r = buildArPaymentByJob({
      arPayments: [
        arp({ id: 'a', jobId: 'small', amountCents: 5_000_00 }),
        arp({ id: 'b', jobId: 'big', amountCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildArPaymentByJob({ arPayments: [] });
    expect(r.rows).toHaveLength(0);
  });
});
