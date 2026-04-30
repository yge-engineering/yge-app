import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioJobStatusYoy } from './portfolio-job-status-yoy';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'PURSUING',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

describe('buildPortfolioJobStatusYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioJobStatusYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', createdAt: '2025-04-15T00:00:00Z' }),
        job({ id: 'b', createdAt: '2026-04-15T00:00:00Z' }),
        job({ id: 'c', createdAt: '2026-05-15T00:00:00Z' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('breaks down by status', () => {
    const r = buildPortfolioJobStatusYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'b', status: 'LOST' }),
      ],
    });
    expect(r.currentByStatus.AWARDED).toBe(1);
    expect(r.currentByStatus.LOST).toBe(1);
  });

  it('breaks down by project type', () => {
    const r = buildPortfolioJobStatusYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b', projectType: 'BRIDGE' }),
      ],
    });
    expect(r.currentByProjectType.ROAD_RECONSTRUCTION).toBe(1);
    expect(r.currentByProjectType.BRIDGE).toBe(1);
  });

  it('counts distinct owners', () => {
    const r = buildPortfolioJobStatusYoy({
      currentYear: 2026,
      jobs: [
        job({ id: 'a', ownerAgency: 'Caltrans D2' }),
        job({ id: 'b', ownerAgency: 'CAL FIRE' }),
      ],
    });
    expect(r.currentDistinctOwners).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioJobStatusYoy({ currentYear: 2026, jobs: [] });
    expect(r.currentTotal).toBe(0);
  });
});
