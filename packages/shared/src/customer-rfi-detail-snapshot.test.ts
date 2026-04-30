import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildCustomerRfiDetailSnapshot } from './customer-rfi-detail-snapshot';

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

function rf(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'X',
    question: '',
    status: 'SENT',
    priority: 'MEDIUM',
    costImpact: false,
    scheduleImpact: false,
    sentAt: '2026-04-10',
    ...over,
  } as Rfi;
}

describe('buildCustomerRfiDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildCustomerRfiDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      rfis: [
        rf({ id: 'a', jobId: 'j1', status: 'CLOSED', sentAt: '2026-04-10', answeredAt: '2026-04-15' }),
        rf({ id: 'b', jobId: 'j1', status: 'SENT', sentAt: '2026-04-12' }),
        rf({ id: 'c', jobId: 'j2', status: 'ANSWERED', sentAt: '2026-04-14', answeredAt: '2026-04-18' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.closed).toBe(1);
    expect(r.rows[0]?.avgDaysToAnswer).toBe(5);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.answered).toBe(1);
    expect(r.rows[1]?.avgDaysToAnswer).toBe(4);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerRfiDetailSnapshot({
      customerName: 'X',
      jobs: [],
      rfis: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
