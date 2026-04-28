import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildJobDrTimeliness } from './job-dr-timeliness';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T17:00:00.000Z',
    updatedAt: '2026-04-15T17:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobDrTimeliness', () => {
  it('classifies same-day / next-day / 2-3 day / 4+ day filings', () => {
    const r = buildJobDrTimeliness({
      jobs: [job({})],
      reports: [
        dr({ id: 'sd', date: '2026-04-15', createdAt: '2026-04-15T17:00:00.000Z' }),
        dr({ id: 'nd', date: '2026-04-15', createdAt: '2026-04-16T08:00:00.000Z' }),
        dr({ id: 'l2', date: '2026-04-15', createdAt: '2026-04-17T08:00:00.000Z' }),
        dr({ id: 'l3', date: '2026-04-15', createdAt: '2026-04-18T08:00:00.000Z' }),
        dr({ id: 'l5', date: '2026-04-15', createdAt: '2026-04-20T08:00:00.000Z' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.sameDay).toBe(1);
    expect(row?.nextDay).toBe(1);
    expect(row?.late2to3).toBe(2);
    expect(row?.late4Plus).toBe(1);
  });

  it('computes onTimeShare = (sameDay + nextDay) / total', () => {
    const r = buildJobDrTimeliness({
      jobs: [job({})],
      reports: [
        dr({ id: 'sd', date: '2026-04-15', createdAt: '2026-04-15T17:00:00.000Z' }),
        dr({ id: 'nd', date: '2026-04-15', createdAt: '2026-04-16T08:00:00.000Z' }),
        dr({ id: 'l4', date: '2026-04-15', createdAt: '2026-04-20T08:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.onTimeShare).toBeCloseTo(2 / 3, 4);
  });

  it('computes median lag', () => {
    const r = buildJobDrTimeliness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', date: '2026-04-15', createdAt: '2026-04-15T17:00:00.000Z' }), // 0
        dr({ id: 'b', date: '2026-04-15', createdAt: '2026-04-17T08:00:00.000Z' }), // 2
        dr({ id: 'c', date: '2026-04-15', createdAt: '2026-04-20T08:00:00.000Z' }), // 5
      ],
    });
    expect(r.rows[0]?.medianLagDays).toBe(2);
  });

  it('skips draft DRs', () => {
    const r = buildJobDrTimeliness({
      jobs: [job({})],
      reports: [
        dr({ id: 'd', submitted: false }),
        dr({ id: 's', submitted: true }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(1);
  });

  it('respects from/to date window on DR.date', () => {
    const r = buildJobDrTimeliness({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      reports: [
        dr({ id: 'old', date: '2026-03-15' }),
        dr({ id: 'in', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(1);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobDrTimeliness({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts lowest onTimeShare first', () => {
    const r = buildJobDrTimeliness({
      jobs: [
        job({ id: 'good' }),
        job({ id: 'bad' }),
      ],
      reports: [
        dr({ id: 'g', jobId: 'good', date: '2026-04-15', createdAt: '2026-04-15T17:00:00.000Z' }),
        dr({ id: 'b', jobId: 'bad', date: '2026-04-15', createdAt: '2026-04-25T08:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('bad');
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobDrTimeliness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', date: '2026-04-15', createdAt: '2026-04-15T17:00:00.000Z' }),
        dr({ id: 'b', date: '2026-04-15', createdAt: '2026-04-25T08:00:00.000Z' }),
      ],
    });
    expect(r.rollup.totalDrs).toBe(2);
    expect(r.rollup.totalSameDay).toBe(1);
    expect(r.rollup.totalLate4Plus).toBe(1);
    expect(r.rollup.blendedOnTimeShare).toBe(0.5);
  });

  it('handles empty input', () => {
    const r = buildJobDrTimeliness({ jobs: [], reports: [] });
    expect(r.rows).toHaveLength(0);
  });
});
