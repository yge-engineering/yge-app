import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerJobByStatusMonthly } from './customer-job-by-status-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: 'CAL FIRE',
    ...over,
  } as Job;
}

describe('buildCustomerJobByStatusMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerJobByStatusMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'A', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'b', ownerAgency: 'A', createdAt: '2026-04-15T00:00:00.000Z' }),
        job({ id: 'c', ownerAgency: 'B', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts each status separately', () => {
    const r = buildCustomerJobByStatusMonthly({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'u', status: 'PURSUING' }),
        job({ id: 'b', status: 'BID_SUBMITTED' }),
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'l', status: 'LOST' }),
        job({ id: 'n', status: 'NO_BID' }),
        job({ id: 'r', status: 'ARCHIVED' }),
      ],
    });
    expect(r.rows[0]?.total).toBe(7);
    expect(r.rows[0]?.awarded).toBe(1);
    expect(r.rows[0]?.lost).toBe(1);
  });

  it('counts unattributed (no ownerAgency)', () => {
    const r = buildCustomerJobByStatusMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'A' }),
        job({ id: 'b', ownerAgency: undefined }),
      ],
    });
    expect(r.rollup.totalJobs).toBe(2);
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('canonicalizes customer name', () => {
    const r = buildCustomerJobByStatusMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'CAL FIRE', createdAt: '2026-04-15T00:00:00.000Z' }),
        job({ id: 'b', ownerAgency: 'Cal Fire, Inc.', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.total).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerJobByStatusMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'mar', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'apr', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by customer asc, month asc', () => {
    const r = buildCustomerJobByStatusMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'Z', createdAt: '2026-04-15T00:00:00.000Z' }),
        job({ id: 'b', ownerAgency: 'A', createdAt: '2026-04-15T00:00:00.000Z' }),
        job({ id: 'c', ownerAgency: 'A', createdAt: '2026-03-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildCustomerJobByStatusMonthly({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
