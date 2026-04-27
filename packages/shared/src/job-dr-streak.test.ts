import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildJobDrStreak } from './job-dr-streak';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-01',
    jobId: 'job-1',
    foremanId: 'emp-foreman',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobDrStreak', () => {
  it('zero streak when no DRs', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [],
    });
    expect(r.rows[0]?.currentStreak).toBe(0);
    expect(r.rows[0]?.longestStreak).toBe(0);
  });

  it('counts current streak ending at asOf (Mon-Fri working days)', () => {
    // asOf = 2026-04-27 (Monday). Streak walking back over working
    // days: 2026-04-27 (Mon), 24 (Fri), 23 (Thu), 22 (Wed), 21 (Tue),
    // 20 (Mon). That's 6 working days. Sun-19 + Sat-18 are skipped.
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [
        dr({ id: '1', date: '2026-04-27' }),
        dr({ id: '2', date: '2026-04-24' }),
        dr({ id: '3', date: '2026-04-23' }),
        dr({ id: '4', date: '2026-04-22' }),
        dr({ id: '5', date: '2026-04-21' }),
        dr({ id: '6', date: '2026-04-20' }),
      ],
    });
    expect(r.rows[0]?.currentStreak).toBe(6);
  });

  it('current streak resets when a working day is missed', () => {
    // 2026-04-27 (Mon) ✓, but 24 (Fri) missing → current = 1
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [
        dr({ id: '1', date: '2026-04-27' }),
        dr({ id: '2', date: '2026-04-23' }),
      ],
    });
    expect(r.rows[0]?.currentStreak).toBe(1);
  });

  it('zero current streak when asOf has no DR (working day)', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [
        dr({ id: '1', date: '2026-04-23' }),
      ],
    });
    expect(r.rows[0]?.currentStreak).toBe(0);
  });

  it('skips draft DRs', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [
        dr({ id: '1', date: '2026-04-27', submitted: false }),
      ],
    });
    expect(r.rows[0]?.currentStreak).toBe(0);
  });

  it('captures last DR date and days since', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [job({})],
      dailyReports: [
        dr({ id: '1', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastDrDate).toBe('2026-04-15');
    expect(r.rows[0]?.daysSinceLastDr).toBe(12);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      dailyReports: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up zero-streak jobs + total streak days', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-active' }),
        job({ id: 'j-dark' }),
      ],
      dailyReports: [
        dr({ jobId: 'j-active', date: '2026-04-27' }),
      ],
    });
    expect(r.rollup.zeroStreakJobs).toBe(1);
    expect(r.rollup.totalCurrentStreakDays).toBe(1);
  });

  it('sorts by current streak desc', () => {
    const r = buildJobDrStreak({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-low' }),
        job({ id: 'j-high' }),
      ],
      dailyReports: [
        dr({ jobId: 'j-high', id: 'h1', date: '2026-04-27' }),
        dr({ jobId: 'j-high', id: 'h2', date: '2026-04-24' }),
        dr({ jobId: 'j-high', id: 'h3', date: '2026-04-23' }),
        dr({ jobId: 'j-low', id: 'l1', date: '2026-04-27' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-high');
  });
});
