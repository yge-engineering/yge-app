import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildCustomerSubmittalSnapshot } from './customer-submittal-snapshot';

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

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    title: 'T',
    specSection: '03 30 00',
    status: 'SUBMITTED',
    submittedAt: '2026-04-01T00:00:00Z',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildCustomerSubmittalSnapshot', () => {
  it('joins submittals to a customer via job.ownerAgency', () => {
    const r = buildCustomerSubmittalSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      submittals: [sub({ id: 'a', jobId: 'j1' }), sub({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalSubmittals).toBe(1);
  });

  it('counts open + overdue + blocks-ordering', () => {
    const r = buildCustomerSubmittalSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', responseDueAt: '2026-04-15' }),
        sub({ id: 'b', status: 'APPROVED' }),
        sub({ id: 'c', status: 'SUBMITTED', blocksOrdering: true }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
    expect(r.blocksOrderingCount).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerSubmittalSnapshot({ customerName: 'X', jobs: [], submittals: [] });
    expect(r.totalSubmittals).toBe(0);
  });
});
