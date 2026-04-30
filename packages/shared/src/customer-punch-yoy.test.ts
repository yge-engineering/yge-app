import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { PunchItem } from './punch-list';

import { buildCustomerPunchYoy } from './customer-punch-yoy';

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

function pi(over: Partial<PunchItem>): PunchItem {
  return {
    id: 'pi-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    identifiedOn: '2026-04-15',
    location: 'Bay 1',
    description: 'T',
    severity: 'MINOR',
    status: 'OPEN',
    ...over,
  } as PunchItem;
}

describe('buildCustomerPunchYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerPunchYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      punchItems: [
        pi({ id: 'a', identifiedOn: '2025-04-15' }),
        pi({ id: 'b', identifiedOn: '2026-04-15', status: 'OPEN' }),
        pi({ id: 'c', identifiedOn: '2026-04-22', status: 'CLOSED' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentOpen).toBe(1);
    expect(r.currentClosed).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerPunchYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      punchItems: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
