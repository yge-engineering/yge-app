import { describe, expect, it } from 'vitest';
import { buildMealBreakSummary } from './meal-break-summary';
import type { DailyReport, DailyReportCrewRow } from './daily-report';

function row(over: Partial<DailyReportCrewRow>): DailyReportCrewRow {
  return {
    employeeId: 'emp-1',
    startTime: '07:00',
    endTime: '15:00',
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

describe('buildMealBreakSummary', () => {
  it('counts no violations on a clean 8-hour shift with lunch', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({}, [
          row({ employeeId: 'emp-1', startTime: '07:00', endTime: '15:30', lunchOut: '11:00', lunchIn: '11:30' }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(0);
  });

  it('flags first-meal-missing on a 9-hour shift with no lunch', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({}, [
          row({
            employeeId: 'emp-1',
            startTime: '07:00',
            endTime: '16:00',
            lunchOut: undefined,
            lunchIn: undefined,
          }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(1);
    expect(r.firstMealCount).toBe(1);
    expect(r.secondMealCount).toBe(0);
  });

  it('flags both first AND second meal missing on a 12-hour no-lunch shift', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({}, [
          row({
            employeeId: 'emp-1',
            startTime: '06:00',
            endTime: '18:00',
            lunchOut: undefined,
            lunchIn: undefined,
          }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(2);
    expect(r.firstMealCount).toBe(1);
    expect(r.secondMealCount).toBe(1);
  });

  it('counts waiver-noted rows as waivedViolations (still in totals)', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({}, [
          row({
            employeeId: 'emp-1',
            startTime: '07:00',
            endTime: '16:00',
            lunchOut: undefined,
            lunchIn: undefined,
            mealBreakWaiverNote: 'Employee waived first meal in writing.',
          }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(1);
    expect(r.waivedViolations).toBe(1);
    expect(r.unwaivedViolations).toBe(0);
  });

  it('skips reports outside the date range', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-13',
      end: '2026-04-17',
      dailyReports: [
        dr({ id: 'in', date: '2026-04-15' }, [
          row({ startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
        dr({ id: 'before', date: '2026-04-01' }, [
          row({ startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
        dr({ id: 'after', date: '2026-04-30' }, [
          row({ startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(1);
    expect(r.reportCount).toBe(1);
  });

  it('skips DRAFT (not submitted) reports', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'draft', submitted: false }, [
          row({ startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
      ],
    });
    expect(r.totalViolations).toBe(0);
  });

  it('rolls up by employee (worst-first)', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', date: '2026-04-13' }, [
          row({ employeeId: 'emp-clean', startTime: '07:00', endTime: '15:30', lunchOut: '11:00', lunchIn: '11:30' }),
          row({ employeeId: 'emp-bad', startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
        dr({ id: 'b', date: '2026-04-14' }, [
          row({ employeeId: 'emp-bad', startTime: '06:00', endTime: '18:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
      ],
    });
    expect(r.byEmployee[0]?.employeeId).toBe('emp-bad');
    expect(r.byEmployee[0]?.totalViolations).toBe(3); // 1 first + 1 first + 1 second
    expect(r.byEmployee[0]?.reportsAffected).toBe(2);
  });

  it('rolls up by job', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'a', jobId: 'job-A' }, [
          row({ startTime: '07:00', endTime: '16:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
        dr({ id: 'b', jobId: 'job-B' }, [
          row({ startTime: '07:00', endTime: '15:30', lunchOut: '11:00', lunchIn: '11:30' }),
        ]),
      ],
    });
    expect(r.byJob[0]?.jobId).toBe('job-A');
    expect(r.byJob[0]?.totalViolations).toBe(1);
  });

  it('sorts rows: unwaived first, then most violations, then most hours', () => {
    const r = buildMealBreakSummary({
      start: '2026-04-01',
      end: '2026-04-30',
      dailyReports: [
        dr({ id: 'a' }, [
          row({
            employeeId: 'waived',
            startTime: '07:00',
            endTime: '16:00',
            lunchOut: undefined,
            lunchIn: undefined,
            mealBreakWaiverNote: 'waived',
          }),
        ]),
        dr({ id: 'b', date: '2026-04-16' }, [
          row({
            employeeId: 'big',
            startTime: '06:00',
            endTime: '18:00',
            lunchOut: undefined,
            lunchIn: undefined,
          }),
        ]),
        dr({ id: 'c', date: '2026-04-17' }, [
          row({
            employeeId: 'medium',
            startTime: '07:00',
            endTime: '16:00',
            lunchOut: undefined,
            lunchIn: undefined,
          }),
        ]),
      ],
    });
    // 'big' has 2 violations, 'medium' has 1, 'waived' is last because
    // it's waived.
    expect(r.rows.map((x) => x.employeeId)).toEqual(['big', 'medium', 'waived']);
  });
});
