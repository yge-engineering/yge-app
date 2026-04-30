import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerJobYoy } from './customer-job-yoy';

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
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildCustomerJobYoy', () => {
  it('compares two years of jobs for one customer', () => {
    const r = buildCustomerJobYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [
        jb({ id: 'a', bidDueDate: '2025-04-15', status: 'AWARDED' }),
        jb({ id: 'b', bidDueDate: '2026-04-15', status: 'PURSUING' }),
        jb({ id: 'c', bidDueDate: '2026-08-15', status: 'AWARDED' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentByStatus.AWARDED).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerJobYoy({ customerName: 'X', currentYear: 2026, jobs: [] });
    expect(r.priorTotal).toBe(0);
  });
});
