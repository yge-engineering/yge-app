import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildPortfolioJobStatusMonthly } from './portfolio-job-status-monthly';

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

describe('buildPortfolioJobStatusMonthly', () => {
  it('breaks down by status', () => {
    const r = buildPortfolioJobStatusMonthly({
      jobs: [
        job({ id: 'a', status: 'PURSUING' }),
        job({ id: 'b', status: 'AWARDED' }),
        job({ id: 'c', status: 'AWARDED' }),
      ],
    });
    expect(r.rows[0]?.byStatus.PURSUING).toBe(1);
    expect(r.rows[0]?.byStatus.AWARDED).toBe(2);
  });

  it('breaks down by projectType', () => {
    const r = buildPortfolioJobStatusMonthly({
      jobs: [
        job({ id: 'a', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b', projectType: 'BRIDGE' }),
        job({ id: 'c', projectType: 'ROAD_RECONSTRUCTION' }),
      ],
    });
    expect(r.rows[0]?.byProjectType.ROAD_RECONSTRUCTION).toBe(2);
    expect(r.rows[0]?.byProjectType.BRIDGE).toBe(1);
  });

  it('counts distinct owners', () => {
    const r = buildPortfolioJobStatusMonthly({
      jobs: [
        job({ id: 'a', ownerAgency: 'Caltrans D2' }),
        job({ id: 'b', ownerAgency: 'CAL FIRE' }),
        job({ id: 'c', ownerAgency: 'Caltrans D2' }),
      ],
    });
    expect(r.rows[0]?.distinctOwners).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioJobStatusMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'old', createdAt: '2026-03-15T00:00:00Z' }),
        job({ id: 'in', createdAt: '2026-04-15T00:00:00Z' }),
      ],
    });
    expect(r.rollup.totalJobs).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioJobStatusMonthly({
      jobs: [
        job({ id: 'a', createdAt: '2026-06-15T00:00:00Z' }),
        job({ id: 'b', createdAt: '2026-04-15T00:00:00Z' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioJobStatusMonthly({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
