import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildJobDrMonthly } from './job-dr-monthly';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    ...over,
  } as DailyReport;
}

describe('buildJobDrMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-15' }),
        dr({ id: 'b', jobId: 'j1', date: '2026-05-01' }),
        dr({ id: 'c', jobId: 'j2', date: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts DRs and distinct dates', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({ id: 'a', date: '2026-04-15' }),
        dr({ id: 'b', date: '2026-04-15' }), // dup date
        dr({ id: 'c', date: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.drs).toBe(3);
    expect(r.rows[0]?.distinctDates).toBe(2);
  });

  it('counts distinct foremen', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({ id: 'a', foremanId: 'f1' }),
        dr({ id: 'b', foremanId: 'f1' }),
        dr({ id: 'c', foremanId: 'f2' }),
      ],
    });
    expect(r.rows[0]?.distinctForemen).toBe(2);
  });

  it('sums crewDays via crewOnSite length', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({
          id: 'a',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
            { employeeId: 'e2', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
        dr({
          id: 'b',
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
      ],
    });
    expect(r.rows[0]?.crewDays).toBe(3);
  });

  it('sums photoCount', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({ id: 'a', photoCount: 5 }),
        dr({ id: 'b', photoCount: 3 }),
      ],
    });
    expect(r.rows[0]?.photoCount).toBe(8);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobDrMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      dailyReports: [
        dr({ id: 'old', date: '2026-03-15' }),
        dr({ id: 'in', date: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDrs).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobDrMonthly({
      dailyReports: [
        dr({ id: 'a', jobId: 'Z', date: '2026-04-15' }),
        dr({ id: 'b', jobId: 'A', date: '2026-05-01' }),
        dr({ id: 'c', jobId: 'A', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildJobDrMonthly({ dailyReports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDrs).toBe(0);
  });
});
