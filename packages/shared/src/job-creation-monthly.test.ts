import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildJobCreationMonthly } from './job-creation-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ...over,
  } as Job;
}

describe('buildJobCreationMonthly', () => {
  it('buckets jobs by yyyy-mm of createdAt', () => {
    const r = buildJobCreationMonthly({
      jobs: [
        job({ id: 'a', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'b', createdAt: '2026-04-10T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each status separately', () => {
    const r = buildJobCreationMonthly({
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

  it('counts distinct project types per month', () => {
    const r = buildJobCreationMonthly({
      jobs: [
        job({ id: 'a', projectType: 'ROAD_RECONSTRUCTION' }),
        job({ id: 'b', projectType: 'BRIDGE' }),
        job({ id: 'c', projectType: 'ROAD_RECONSTRUCTION' }),
      ],
    });
    expect(r.rows[0]?.distinctProjectTypes).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildJobCreationMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [
        job({ id: 'mar', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'apr', createdAt: '2026-04-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month created change', () => {
    const r = buildJobCreationMonthly({
      jobs: [
        job({ id: 'mar1', createdAt: '2026-03-15T00:00:00.000Z' }),
        job({ id: 'apr1', createdAt: '2026-04-10T00:00:00.000Z' }),
        job({ id: 'apr2', createdAt: '2026-04-12T00:00:00.000Z' }),
        job({ id: 'apr3', createdAt: '2026-04-20T00:00:00.000Z' }),
      ],
    });
    expect(r.rollup.monthOverMonthCreatedChange).toBe(2);
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobCreationMonthly({
      jobs: [
        job({ id: 'a', status: 'AWARDED' }),
        job({ id: 'p', status: 'PURSUING' }),
        job({ id: 'l', status: 'LOST' }),
      ],
    });
    expect(r.rollup.totalCreated).toBe(3);
    expect(r.rollup.totalAwarded).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildJobCreationMonthly({
      jobs: [
        job({ id: 'late', createdAt: '2026-04-15T00:00:00.000Z' }),
        job({ id: 'early', createdAt: '2026-02-15T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildJobCreationMonthly({ jobs: [] });
    expect(r.rows).toHaveLength(0);
  });
});
