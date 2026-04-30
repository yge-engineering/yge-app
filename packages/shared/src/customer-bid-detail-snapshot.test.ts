import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerBidDetailSnapshot } from './customer-bid-detail-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'Project A',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    bidDueDate: '2026-04-15',
    ...over,
  } as Job;
}

describe('buildCustomerBidDetailSnapshot', () => {
  it('returns one row per pursuit sorted by due date desc', () => {
    const r = buildCustomerBidDetailSnapshot({
      customerName: 'Caltrans',
      jobs: [
        jb({ id: 'a', projectName: 'A', bidDueDate: '2026-03-15' }),
        jb({ id: 'b', projectName: 'B', bidDueDate: '2026-05-15' }),
        jb({ id: 'c', projectName: 'C', bidDueDate: '2026-04-15', ownerAgency: 'Other' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.projectName).toBe('B');
    expect(r.rows[1]?.projectName).toBe('A');
  });

  it('handles unknown customer', () => {
    const r = buildCustomerBidDetailSnapshot({ customerName: 'X', jobs: [] });
    expect(r.rows.length).toBe(0);
  });
});
