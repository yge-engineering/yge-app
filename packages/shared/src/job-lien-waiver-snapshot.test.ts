import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildJobLienWaiverSnapshot } from './job-lien-waiver-snapshot';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'Owner A',
    jobName: 'Job A',
    claimantName: 'YGE',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    signedOn: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildJobLienWaiverSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobLienWaiverSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1' }),
        lw({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalWaivers).toBe(1);
  });

  it('counts by status', () => {
    const r = buildJobLienWaiverSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED' }),
        lw({ id: 'b', status: 'DELIVERED' }),
        lw({ id: 'c', status: 'DRAFT' }),
        lw({ id: 'd', status: 'VOIDED' }),
      ],
    });
    expect(r.signedWaivers).toBe(1);
    expect(r.deliveredWaivers).toBe(1);
    expect(r.draftWaivers).toBe(1);
    expect(r.voidedWaivers).toBe(1);
  });

  it('sums payment + disputed (excluding voided)', () => {
    const r = buildJobLienWaiverSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED', paymentAmountCents: 50_000_00, disputedAmountCents: 5_000_00 }),
        lw({ id: 'b', status: 'VOIDED', paymentAmountCents: 99_999_00 }),
      ],
    });
    expect(r.totalPaymentAmountCents).toBe(50_000_00);
    expect(r.totalDisputedAmountCents).toBe(5_000_00);
  });

  it('tracks last signed/delivered date', () => {
    const r = buildJobLienWaiverSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', signedOn: '2026-04-08' }),
        lw({ id: 'b', signedOn: '2026-04-15', deliveredOn: '2026-04-22' }),
      ],
    });
    expect(r.lastSignedOrDeliveredDate).toBe('2026-04-22');
  });

  it('handles no matching waivers', () => {
    const r = buildJobLienWaiverSnapshot({ jobId: 'j1', lienWaivers: [] });
    expect(r.totalWaivers).toBe(0);
    expect(r.lastSignedOrDeliveredDate).toBeNull();
  });
});
