import { describe, expect, it } from 'vitest';

import type { ArPayment } from './ar-payment';
import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

import { buildJobWaiverDeliveryRate } from './job-waiver-delivery-rate';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function pay(over: Partial<ArPayment>): ArPayment {
  return {
    id: 'arp-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    arInvoiceId: 'ar-1',
    jobId: 'j1',
    kind: 'PROGRESS',
    method: 'CHECK',
    receivedOn: '2026-04-15',
    amountCents: 50_000_00,
    ...over,
  } as ArPayment;
}

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'DELIVERED',
    ownerName: 'CAL FIRE',
    jobName: 'Sulphur Springs',
    claimantName: 'YGE',
    paymentAmountCents: 50_000_00,
    throughDate: '2026-04-15',
    deliveredOn: '2026-04-18',
    ...over,
  } as LienWaiver;
}

describe('buildJobWaiverDeliveryRate', () => {
  it('counts payments + waivers + delivered', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [job({})],
      arPayments: [
        pay({ id: 'p1' }),
        pay({ id: 'p2' }),
      ],
      lienWaivers: [
        lw({ id: 'w1' }),
        lw({ id: 'w2', deliveredOn: undefined, status: 'SIGNED' }),
      ],
    });
    expect(r.rows[0]?.paymentCount).toBe(2);
    expect(r.rows[0]?.waiverCount).toBe(2);
    expect(r.rows[0]?.deliveredCount).toBe(1);
  });

  it('skips VOIDED waivers', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [job({})],
      arPayments: [pay({})],
      lienWaivers: [
        lw({ id: 'v', status: 'VOIDED' }),
        lw({ id: 'd' }),
      ],
    });
    expect(r.rows[0]?.waiverCount).toBe(1);
  });

  it('computes deliveryRate', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [job({})],
      arPayments: [
        pay({ id: 'p1' }),
        pay({ id: 'p2' }),
        pay({ id: 'p3' }),
      ],
      lienWaivers: [
        lw({ id: 'w1' }),
        lw({ id: 'w2' }),
      ],
    });
    expect(r.rows[0]?.deliveryRate).toBeCloseTo(2 / 3, 4);
  });

  it('computes gap = paymentCount - deliveredCount', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [job({})],
      arPayments: [pay({ id: 'p1' }), pay({ id: 'p2' }), pay({ id: 'p3' })],
      lienWaivers: [lw({ id: 'w' })],
    });
    expect(r.rows[0]?.gap).toBe(2);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      arPayments: [],
      lienWaivers: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts largest gap first', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [
        job({ id: 'clean' }),
        job({ id: 'gappy' }),
      ],
      arPayments: [
        pay({ id: 'c', jobId: 'clean' }),
        pay({ id: 'g1', jobId: 'gappy' }),
        pay({ id: 'g2', jobId: 'gappy' }),
      ],
      lienWaivers: [
        lw({ id: 'cw', jobId: 'clean' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('gappy');
  });

  it('rolls up portfolio totals + blended rate', () => {
    const r = buildJobWaiverDeliveryRate({
      jobs: [job({})],
      arPayments: [pay({ id: 'p1' }), pay({ id: 'p2' })],
      lienWaivers: [lw({})],
    });
    expect(r.rollup.totalPayments).toBe(2);
    expect(r.rollup.totalDelivered).toBe(1);
    expect(r.rollup.totalGap).toBe(1);
    expect(r.rollup.blendedDeliveryRate).toBe(0.5);
  });

  it('handles empty input', () => {
    const r = buildJobWaiverDeliveryRate({ jobs: [], arPayments: [], lienWaivers: [] });
    expect(r.rows).toHaveLength(0);
  });
});
