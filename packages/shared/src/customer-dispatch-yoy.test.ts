import { describe, expect, it } from 'vitest';

import type { Dispatch } from './dispatch';
import type { Job } from './job';

import { buildCustomerDispatchYoy } from './customer-dispatch-yoy';

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

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [{ name: 'A' }, { name: 'B' }],
    equipment: [{ name: 'X' }],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerDispatchYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerDispatchYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      dispatches: [
        dp({ id: 'a', scheduledFor: '2025-04-15' }),
        dp({ id: 'b', scheduledFor: '2026-04-15' }),
        dp({ id: 'c', scheduledFor: '2026-04-22' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerDispatchYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      dispatches: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
