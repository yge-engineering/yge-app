import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildCustomerSubmittalYoy } from './customer-submittal-yoy';

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

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00Z',
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

describe('buildCustomerSubmittalYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerSubmittalYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      submittals: [
        sub({ id: 'a', submittedAt: '2025-04-01T00:00:00Z' }),
        sub({ id: 'b', submittedAt: '2026-04-01T00:00:00Z', blocksOrdering: true }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.currentBlocksOrdering).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerSubmittalYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      submittals: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
