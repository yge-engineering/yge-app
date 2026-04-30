import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildCustomerSubmittalDetailSnapshot } from './customer-submittal-detail-snapshot';

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

function sb(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'X',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    submittedAt: '2026-04-10',
    ...over,
  } as Submittal;
}

describe('buildCustomerSubmittalDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildCustomerSubmittalDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      submittals: [
        sb({ id: 'a', jobId: 'j1', status: 'APPROVED', submittedAt: '2026-04-10', returnedAt: '2026-04-17' }),
        sb({ id: 'b', jobId: 'j1', status: 'SUBMITTED', submittedAt: '2026-04-12' }),
        sb({ id: 'c', jobId: 'j2', status: 'REVISE_RESUBMIT', submittedAt: '2026-04-14', returnedAt: '2026-04-20' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.approved).toBe(1);
    expect(r.rows[0]?.avgDaysToReturn).toBe(7);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.reviseResubmit).toBe(1);
    expect(r.rows[1]?.avgDaysToReturn).toBe(6);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerSubmittalDetailSnapshot({
      customerName: 'X',
      jobs: [],
      submittals: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
