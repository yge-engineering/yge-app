import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioJobStatusSnapshot } from './portfolio-job-status-snapshot';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'PURSUING',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

describe('buildPortfolioJobStatusSnapshot', () => {
  it('counts total + status + project type + owners', () => {
    const r = buildPortfolioJobStatusSnapshot({
      jobs: [
        job({ id: 'a', status: 'AWARDED', projectType: 'ROAD_RECONSTRUCTION', ownerAgency: 'Caltrans D2' }),
        job({ id: 'b', status: 'PURSUING', projectType: 'BRIDGE', ownerAgency: 'CAL FIRE' }),
        job({ id: 'c', status: 'AWARDED', projectType: 'ROAD_RECONSTRUCTION', ownerAgency: 'Caltrans D2' }),
      ],
    });
    expect(r.totalJobs).toBe(3);
    expect(r.byStatus.AWARDED).toBe(2);
    expect(r.byProjectType.ROAD_RECONSTRUCTION).toBe(2);
    expect(r.distinctOwners).toBe(2);
  });

  it('counts pursuitInFlight (PROSPECT + PURSUING + BID_SUBMITTED) + awardedActive', () => {
    const r = buildPortfolioJobStatusSnapshot({
      jobs: [
        job({ id: 'a', status: 'PROSPECT' }),
        job({ id: 'b', status: 'PURSUING' }),
        job({ id: 'c', status: 'BID_SUBMITTED' }),
        job({ id: 'd', status: 'AWARDED' }),
        job({ id: 'e', status: 'AWARDED' }),
        job({ id: 'f', status: 'LOST' }),
      ],
    });
    expect(r.pursuitInFlight).toBe(3);
    expect(r.awardedActive).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioJobStatusSnapshot({ jobs: [] });
    expect(r.totalJobs).toBe(0);
  });
});
