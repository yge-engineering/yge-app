import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildCustomerJobPipeline } from './customer-job-pipeline';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: 'CAL FIRE',
    ...over,
  } as Job;
}

describe('buildCustomerJobPipeline', () => {
  it('groups by ownerAgency (canonicalized)', () => {
    const r = buildCustomerJobPipeline({
      jobs: [
        job({ id: 'a', ownerAgency: 'CAL FIRE' }),
        job({ id: 'b', ownerAgency: 'Cal Fire, Inc.' }),
        job({ id: 'c', ownerAgency: 'cal fire dept' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.total).toBe(3);
  });

  it('counts every status separately', () => {
    const r = buildCustomerJobPipeline({
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
    const row = r.rows[0];
    expect(row?.prospect).toBe(1);
    expect(row?.pursuing).toBe(1);
    expect(row?.bidSubmitted).toBe(1);
    expect(row?.awarded).toBe(1);
    expect(row?.lost).toBe(1);
    expect(row?.noBid).toBe(1);
    expect(row?.archived).toBe(1);
    expect(row?.total).toBe(7);
  });

  it('counts unattributed jobs (no ownerAgency) on rollup, excludes from rows', () => {
    const r = buildCustomerJobPipeline({
      jobs: [
        job({ id: 'a', ownerAgency: 'CAL FIRE' }),
        job({ id: 'b', ownerAgency: undefined }),
        job({ id: 'c', ownerAgency: '   ' }),
      ],
    });
    expect(r.rollup.total).toBe(3);
    expect(r.rollup.unattributed).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by awarded desc, ties by total desc', () => {
    const r = buildCustomerJobPipeline({
      jobs: [
        job({ id: 'big1', ownerAgency: 'Big', status: 'PURSUING' }),
        job({ id: 'big2', ownerAgency: 'Big', status: 'PURSUING' }),
        job({ id: 'big3', ownerAgency: 'Big', status: 'PURSUING' }),
        job({ id: 'won1', ownerAgency: 'Winner', status: 'AWARDED' }),
        job({ id: 'won2', ownerAgency: 'Winner', status: 'PURSUING' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Winner');
  });

  it('rolls up portfolio totals + awarded count', () => {
    const r = buildCustomerJobPipeline({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'p', status: 'PURSUING' }),
        job({ id: 'l', status: 'LOST' }),
      ],
    });
    expect(r.rollup.total).toBe(3);
    expect(r.rollup.awarded).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildCustomerJobPipeline({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
