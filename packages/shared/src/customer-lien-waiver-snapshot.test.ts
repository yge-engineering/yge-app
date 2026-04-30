import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

import { buildCustomerLienWaiverSnapshot } from './customer-lien-waiver-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
  } as Job;
}

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'Caltrans',
    jobName: 'Job A',
    claimantName: 'YGE',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    signedOn: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildCustomerLienWaiverSnapshot', () => {
  it('matches via ownerName or job-owner agency', () => {
    const r = buildCustomerLienWaiverSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      lienWaivers: [
        lw({ id: 'a', ownerName: 'Caltrans' }),
        lw({ id: 'b', ownerName: 'Other', jobId: 'j1' }),
        lw({ id: 'c', ownerName: 'Other', jobId: 'jX' }),
      ],
    });
    expect(r.totalWaivers).toBe(2);
  });

  it('sums payment + disputed (excluding voided)', () => {
    const r = buildCustomerLienWaiverSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED', paymentAmountCents: 50_000_00, disputedAmountCents: 5_000_00 }),
        lw({ id: 'b', status: 'VOIDED', paymentAmountCents: 99_999_00 }),
      ],
    });
    expect(r.totalPaymentAmountCents).toBe(50_000_00);
    expect(r.totalDisputedAmountCents).toBe(5_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerLienWaiverSnapshot({ customerName: 'X', jobs: [], lienWaivers: [] });
    expect(r.totalWaivers).toBe(0);
  });
});
