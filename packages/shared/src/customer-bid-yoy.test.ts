import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerBidYoy } from './customer-bid-yoy';

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

describe('buildCustomerBidYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerBidYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [
        jb({ id: 'a', bidDueDate: '2025-04-15', status: 'AWARDED' }),
        jb({ id: 'b', bidDueDate: '2025-08-15', status: 'LOST' }),
        jb({ id: 'c', bidDueDate: '2026-04-15', status: 'AWARDED' }),
        jb({ id: 'd', bidDueDate: '2026-04-15', status: 'AWARDED' }),
      ],
    });
    expect(r.priorTotal).toBe(2);
    expect(r.priorAwarded).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.currentAwarded).toBe(2);
  });

  it('computes win rate + delta', () => {
    const r = buildCustomerBidYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [
        jb({ id: 'a', bidDueDate: '2025-04-15', status: 'AWARDED' }),
        jb({ id: 'b', bidDueDate: '2025-08-15', status: 'LOST' }),
        jb({ id: 'c', bidDueDate: '2026-04-15', status: 'AWARDED' }),
        jb({ id: 'd', bidDueDate: '2026-08-15', status: 'AWARDED' }),
      ],
    });
    expect(r.priorWinRate).toBeCloseTo(0.5);
    expect(r.currentWinRate).toBeCloseTo(1.0);
    expect(r.winRateDelta).toBeCloseTo(0.5);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerBidYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
    });
    expect(r.priorTotal).toBe(0);
    expect(r.priorWinRate).toBeNull();
  });
});
