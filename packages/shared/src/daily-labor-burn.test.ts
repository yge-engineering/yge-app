import { describe, expect, it } from 'vitest';

import type { DailyReport, DailyReportCrewRow } from './daily-report';

import { buildDailyLaborBurn } from './daily-labor-burn';

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

describe('buildDailyLaborBurn', () => {
  it('skips draft DRs', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [dr({ submitted: false, crewOnSite: [row({})] })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('respects window bounds', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dailyReports: [
        dr({ id: 'dr-1', date: '2026-04-10', crewOnSite: [row({})] }),
        dr({ id: 'dr-2', date: '2026-04-20', crewOnSite: [row({})] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.date).toBe('2026-04-20');
  });

  it('sums worked hours across crew rows', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          crewOnSite: [
            row({ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }), // 8h
            row({ employeeId: 'e2', startTime: '06:00', endTime: '15:00' }), // 9h
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalWorkedHours).toBe(17);
  });

  it('counts distinct employees across multiple DRs same day', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          id: 'dr-1',
          jobId: 'job-A',
          crewOnSite: [row({ employeeId: 'e1' }), row({ employeeId: 'e2' })],
        }),
        dr({
          id: 'dr-2',
          jobId: 'job-B',
          crewOnSite: [row({ employeeId: 'e2' }), row({ employeeId: 'e3' })],
        }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(3);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.drsFiled).toBe(2);
  });

  it('computes avg crew size across DRs that day', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          id: 'dr-1',
          crewOnSite: [row({ employeeId: 'e1' }), row({ employeeId: 'e2' })],
        }),
        dr({
          id: 'dr-2',
          crewOnSite: [
            row({ employeeId: 'e3' }),
            row({ employeeId: 'e4' }),
            row({ employeeId: 'e5' }),
            row({ employeeId: 'e6' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.avgCrewSize).toBe(3);
  });

  it('rolls up peak day + total + avg', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [
        dr({
          id: 'dr-light',
          date: '2026-04-01',
          crewOnSite: [row({ employeeId: 'e1' })],
        }),
        dr({
          id: 'dr-heavy',
          date: '2026-04-02',
          crewOnSite: [
            row({ employeeId: 'e1' }),
            row({ employeeId: 'e2' }),
            row({ employeeId: 'e3' }),
          ],
        }),
      ],
    });
    expect(r.rollup.daysWithActivity).toBe(2);
    expect(r.rollup.totalWorkedHours).toBe(32); // 8 + 24
    expect(r.rollup.peakDayHours).toBe(24);
    expect(r.rollup.peakDayDate).toBe('2026-04-02');
    expect(r.rollup.avgWorkedHoursPerActiveDay).toBe(16);
  });

  it('sorts rows by date asc', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [
        dr({ id: 'dr-late', date: '2026-04-20', crewOnSite: [row({})] }),
        dr({ id: 'dr-early', date: '2026-04-05', crewOnSite: [row({})] }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
    expect(r.rows[1]?.date).toBe('2026-04-20');
  });

  it('handles empty input gracefully', () => {
    const r = buildDailyLaborBurn({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      dailyReports: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalWorkedHours).toBe(0);
    expect(r.rollup.peakDayDate).toBe(null);
  });
});
