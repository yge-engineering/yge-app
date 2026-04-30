import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerJobSnapshot } from './customer-job-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
  } as Job;
}

describe('buildCustomerJobSnapshot', () => {
  it('counts jobs by status for one customer', () => {
    const r = buildCustomerJobSnapshot({
      customerName: 'Caltrans',
      jobs: [
        jb({ id: 'a', status: 'AWARDED' }),
        jb({ id: 'b', status: 'AWARDED' }),
        jb({ id: 'c', status: 'LOST' }),
        jb({ id: 'd', status: 'ARCHIVED' }),
        jb({ id: 'e', status: 'PURSUING', ownerAgency: 'Other' }),
      ],
    });
    expect(r.totalJobs).toBe(4);
    expect(r.activeJobs).toBe(2);
    expect(r.archivedJobs).toBe(1);
    expect(r.byStatus.LOST).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerJobSnapshot({ customerName: 'X', jobs: [] });
    expect(r.totalJobs).toBe(0);
  });
});
