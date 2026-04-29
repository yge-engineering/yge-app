import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildJobByProjectType } from './job-by-project-type';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ...over,
  } as Job;
}

describe('buildJobByProjectType', () => {
  it('groups jobs by projectType', () => {
    const r = buildJobByProjectType({
      jobs: [
        job({ id: 'a', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b', projectType: 'BRIDGE' }),
        job({ id: 'c', projectType: 'ROAD_RECONSTRUCTION' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const road = r.rows.find((x) => x.projectType === 'ROAD_RECONSTRUCTION');
    expect(road?.total).toBe(2);
  });

  it('counts each status separately', () => {
    const r = buildJobByProjectType({
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

  it('computes winRate over decided pursuits', () => {
    const r = buildJobByProjectType({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'l', status: 'LOST' }),
        job({ id: 'n', status: 'NO_BID' }),
        job({ id: 'p', status: 'PURSUING' }),
      ],
    });
    expect(r.rows[0]?.winRate).toBeCloseTo(0.3333, 3);
  });

  it('returns winRate=0 when no decided pursuits', () => {
    const r = buildJobByProjectType({
      jobs: [job({ id: 'p', status: 'PURSUING' })],
    });
    expect(r.rows[0]?.winRate).toBe(0);
  });

  it('sorts by total desc', () => {
    const r = buildJobByProjectType({
      jobs: [
        job({ id: 's', projectType: 'BRIDGE' }),
        job({ id: 'b1', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b2', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b3', projectType: 'ROAD_RECONSTRUCTION' }),
      ],
    });
    expect(r.rows[0]?.projectType).toBe('ROAD_RECONSTRUCTION');
  });

  it('rolls up totals + awarded', () => {
    const r = buildJobByProjectType({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'b', status: 'LOST' }),
      ],
    });
    expect(r.rollup.totalJobs).toBe(2);
    expect(r.rollup.totalAwarded).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildJobByProjectType({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
