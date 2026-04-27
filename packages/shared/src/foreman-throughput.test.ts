import { describe, expect, it } from 'vitest';

import type { DailyReport, DailyReportCrewRow } from './daily-report';

import { buildForemanThroughput } from './foreman-throughput';

function row(over: Partial<DailyReportCrewRow>): DailyReportCrewRow {
  return {
    employeeId: 'emp-1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as DailyReportCrewRow;
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

describe('buildForemanThroughput', () => {
  it('skips draft DRs', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({ submitted: false, crewOnSite: [row({})] }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('counts distinct employees managed', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          id: 'dr-1',
          crewOnSite: [
            row({ employeeId: 'e1' }),
            row({ employeeId: 'e2' }),
          ],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [row({ employeeId: 'e1' }), row({ employeeId: 'e3' })],
        }),
      ],
    });
    expect(r.rows[0]?.distinctEmployeesManaged).toBe(3);
  });

  it('computes avg crew size and peak', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          id: 'dr-1',
          crewOnSite: [row({ employeeId: 'e1' }), row({ employeeId: 'e2' })],
        }),
        dr({
          id: 'dr-2',
          date: '2026-04-02',
          crewOnSite: [
            row({ employeeId: 'e1' }),
            row({ employeeId: 'e2' }),
            row({ employeeId: 'e3' }),
            row({ employeeId: 'e4' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.avgCrewSize).toBe(3);
    expect(r.rows[0]?.peakCrewSize).toBe(4);
  });

  it('sums crew hours from crewRowWorkedMinutes', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          crewOnSite: [
            row({ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }), // 8h
            row({ employeeId: 'e2', startTime: '07:00', endTime: '15:00' }), // 8h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalCrewHours).toBe(16);
  });

  it('counts distinct jobs run', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({ id: 'dr-1', jobId: 'job-A', crewOnSite: [row({})] }),
        dr({ id: 'dr-2', date: '2026-04-02', jobId: 'job-B', crewOnSite: [row({})] }),
        dr({ id: 'dr-3', date: '2026-04-03', jobId: 'job-A', crewOnSite: [row({})] }),
      ],
    });
    expect(r.rows[0]?.distinctJobsRun).toBe(2);
  });

  it('respects window bounds', () => {
    const r = buildForemanThroughput({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dailyReports: [
        dr({ id: 'dr-1', date: '2026-04-10', crewOnSite: [row({})] }),
        dr({ id: 'dr-2', date: '2026-04-20', crewOnSite: [row({})] }),
      ],
    });
    expect(r.rows[0]?.drsSubmitted).toBe(1);
  });

  it('flags large-crew foremen (avg >=8)', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          foremanId: 'big-crew',
          crewOnSite: Array.from({ length: 10 }, (_, i) =>
            row({ employeeId: `e${i}` }),
          ),
        }),
        dr({
          id: 'dr-2',
          foremanId: 'small-crew',
          crewOnSite: Array.from({ length: 3 }, (_, i) =>
            row({ employeeId: `e${i}` }),
          ),
        }),
      ],
    });
    expect(r.rollup.largeCrewForemenCount).toBe(1);
  });

  it('rolls up totals', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          foremanId: 'fa',
          crewOnSite: [row({ employeeId: 'e1' })],
        }),
        dr({
          id: 'dr-2',
          foremanId: 'fb',
          crewOnSite: [row({ employeeId: 'e2' })],
        }),
      ],
    });
    expect(r.rollup.foremenConsidered).toBe(2);
    expect(r.rollup.totalDrs).toBe(2);
    expect(r.rollup.totalCrewHours).toBe(16);
  });

  it('sorts by crewDayCount desc', () => {
    const r = buildForemanThroughput({
      dailyReports: [
        dr({
          id: 'dr-low',
          foremanId: 'low',
          crewOnSite: [row({ employeeId: 'e1' })],
        }),
        dr({
          id: 'dr-high',
          foremanId: 'high',
          crewOnSite: Array.from({ length: 5 }, (_, i) =>
            row({ employeeId: `e${i}` }),
          ),
        }),
      ],
    });
    expect(r.rows[0]?.foremanId).toBe('high');
    expect(r.rows[1]?.foremanId).toBe('low');
  });
});
