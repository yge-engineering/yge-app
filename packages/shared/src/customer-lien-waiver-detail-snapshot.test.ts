import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { LienWaiver } from './lien-waiver';

import { buildCustomerLienWaiverDetailSnapshot } from './customer-lien-waiver-detail-snapshot';

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
    jobName: 'X',
    claimantName: 'YGE',
    paymentAmountCents: 50_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildCustomerLienWaiverDetailSnapshot', () => {
  it('returns one row per job sorted by total waived', () => {
    const r = buildCustomerLienWaiverDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1', kind: 'UNCONDITIONAL_PROGRESS', status: 'DELIVERED', paymentAmountCents: 100_000_00 }),
        lw({ id: 'b', jobId: 'j1', kind: 'CONDITIONAL_FINAL', status: 'DRAFT', paymentAmountCents: 50_000_00 }),
        lw({ id: 'c', jobId: 'j2', kind: 'CONDITIONAL_PROGRESS', status: 'SIGNED', paymentAmountCents: 25_000_00 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.delivered).toBe(1);
    expect(r.rows[0]?.draft).toBe(1);
    expect(r.rows[0]?.unconditional).toBe(1);
    expect(r.rows[0]?.conditional).toBe(1);
    expect(r.rows[0]?.progress).toBe(1);
    expect(r.rows[0]?.final).toBe(1);
    // Only DELIVERED counts (DRAFT excluded)
    expect(r.rows[0]?.totalWaivedCents).toBe(100_000_00);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.signed).toBe(1);
    expect(r.rows[1]?.totalWaivedCents).toBe(25_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerLienWaiverDetailSnapshot({
      customerName: 'X',
      jobs: [],
      lienWaivers: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
