import { describe, expect, it } from 'vitest';
import { buildDrWeeklySummary } from './dr-weekly-summary';
import type { DailyReport, DailyReportCrewRow } from './daily-report';

function row(over: Partial<DailyReportCrewRow>): DailyReportCrewRow {
  return {
    employeeId: 'emp-1',
    startTime: '07:00',
    endTime: '15:30',
    lunchOut: '11:00',
    lunchIn: '11:30',
    ...over,
  } as DailyReportCrewRow;
}

function dr(over: Partial<DailyReport>, rows: Partial<DailyReportCrewRow>[] = []): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: rows.map((r) => row(r)),
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildDrWeeklySummary', () => {
  it('groups reports by ISO week (Monday key)', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-26',
      dailyReports: [
        dr({ id: '1', date: '2026-04-13' }),  // Mon
        dr({ id: '2', date: '2026-04-15' }),  // Wed same week
        dr({ id: '3', date: '2026-04-21' }),  // Tue next week
      ],
    });
    expect(r.weeks).toHaveLength(2);
    expect(r.weeks[0]?.weekStarting).toBe('2026-04-13');
    expect(r.weeks[1]?.weekStarting).toBe('2026-04-20');
  });

  it('sums crew hours per week', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-19',
      dailyReports: [
        dr({ id: '1', date: '2026-04-13' }, [
          row({ startTime: '07:00', endTime: '15:30', lunchOut: '11:00', lunchIn: '11:30' }), // 8
          row({ startTime: '07:00', endTime: '15:30', lunchOut: '11:00', lunchIn: '11:30' }), // 8
        ]),
      ],
    });
    expect(r.weeks[0]?.totalCrewHours).toBe(16);
  });

  it('sums photos and tracks distinct jobs', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-19',
      dailyReports: [
        dr({ id: '1', jobId: 'a', date: '2026-04-13', photoCount: 3 }),
        dr({ id: '2', jobId: 'b', date: '2026-04-14', photoCount: 5 }),
      ],
    });
    expect(r.weeks[0]?.totalPhotos).toBe(8);
    expect(r.weeks[0]?.distinctJobs).toBe(2);
  });

  it('counts reports with issues', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-19',
      dailyReports: [
        dr({ id: '1', date: '2026-04-13', issues: 'Late delivery' }),
        dr({ id: '2', date: '2026-04-14' }),
        dr({ id: '3', date: '2026-04-15', issues: '' }),
      ],
    });
    expect(r.weeks[0]?.reportsWithIssues).toBe(1);
  });

  it('skips DRAFT reports', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-19',
      dailyReports: [dr({ submitted: false })],
    });
    expect(r.weeks).toHaveLength(0);
  });

  it('honors date range', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-13',
      end: '2026-04-19',
      dailyReports: [
        dr({ id: '1', date: '2026-04-15' }),
        dr({ id: '2', date: '2026-04-30' }), // out
      ],
    });
    expect(r.weeks[0]?.reportCount).toBe(1);
  });

  it('outputs weeks chronologically', () => {
    const r = buildDrWeeklySummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'late', date: '2026-04-25' }),
        dr({ id: 'early', date: '2026-04-02' }),
        dr({ id: 'mid', date: '2026-04-15' }),
      ],
    });
    const weeks = r.weeks.map((w) => w.weekStarting);
    expect(weeks).toEqual([...weeks].sort());
  });
});
