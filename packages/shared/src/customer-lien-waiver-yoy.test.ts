import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

import { buildCustomerLienWaiverYoy } from './customer-lien-waiver-yoy';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
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
    ...over,
  } as LienWaiver;
}

describe('buildCustomerLienWaiverYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerLienWaiverYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      lienWaivers: [
        lw({ id: 'a', throughDate: '2025-04-15', paymentAmountCents: 50_000_00 }),
        lw({ id: 'b', throughDate: '2026-04-15', paymentAmountCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.paymentAmountDelta).toBe(50_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerLienWaiverYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      lienWaivers: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
