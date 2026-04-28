import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';

import { buildOvertimeMonthly } from './overtime-monthly';

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    date: '2026-04-15', // Wednesday
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

const c = (id: string, start: string, end: string) =>
  ({ employeeId: id, startTime: start, endTime: end });

describe('buildOvertimeMonthly', () => {
  it('counts 8-hour shift as zero OT', () => {
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'a', crewOnSite: [c('e1', '07:00', '15:00')] }),
      ],
    });
    expect(r.rows[0]?.totalHours).toBe(8);
    expect(r.rows[0]?.dailyOtHours).toBe(0);
    expect(r.rows[0]?.combinedOtHours).toBe(0);
  });

  it('counts hours above 8 in a shift as daily OT', () => {
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'a', crewOnSite: [c('e1', '06:00', '16:00')] }), // 10h
      ],
    });
    expect(r.rows[0]?.dailyOtHours).toBe(2);
  });

  it('counts hours over 40/week as weekly OT', () => {
    // 5 × 9-hour shifts in same week = 45 hours.
    // Daily OT: 5 × 1 = 5 hours.
    // Weekly OT: 45 - 40 = 5 hours.
    // Max-per-week: max(5, 5) = 5 → combined = 5
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'mon', date: '2026-04-13', crewOnSite: [c('e1', '07:00', '16:00')] }),
        dr({ id: 'tue', date: '2026-04-14', crewOnSite: [c('e1', '07:00', '16:00')] }),
        dr({ id: 'wed', date: '2026-04-15', crewOnSite: [c('e1', '07:00', '16:00')] }),
        dr({ id: 'thu', date: '2026-04-16', crewOnSite: [c('e1', '07:00', '16:00')] }),
        dr({ id: 'fri', date: '2026-04-17', crewOnSite: [c('e1', '07:00', '16:00')] }),
      ],
    });
    const row = r.rows[0];
    expect(row?.totalHours).toBe(45);
    expect(row?.dailyOtHours).toBe(5);
    expect(row?.weeklyOtHours).toBe(5);
    expect(row?.combinedOtHours).toBe(5);
  });

  it('does not double-count when daily and weekly OT overlap', () => {
    // 5 × 10-hour shifts = 50 hours.
    // Daily OT: 5 × 2 = 10 hours.
    // Weekly OT: 50 - 40 = 10 hours.
    // Max-per-week: 10 (not 20)
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'mon', date: '2026-04-13', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'tue', date: '2026-04-14', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'wed', date: '2026-04-15', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'thu', date: '2026-04-16', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'fri', date: '2026-04-17', crewOnSite: [c('e1', '06:00', '16:00')] }),
      ],
    });
    expect(r.rows[0]?.combinedOtHours).toBe(10);
  });

  it('computes OT share', () => {
    const r = buildOvertimeMonthly({
      reports: [
        // 1 employee, 50 hours in week with 10 hrs of OT
        dr({ id: 'mon', date: '2026-04-13', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'tue', date: '2026-04-14', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'wed', date: '2026-04-15', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'thu', date: '2026-04-16', crewOnSite: [c('e1', '06:00', '16:00')] }),
        dr({ id: 'fri', date: '2026-04-17', crewOnSite: [c('e1', '06:00', '16:00')] }),
      ],
    });
    expect(r.rows[0]?.otShare).toBe(0.2);
  });

  it('skips draft reports', () => {
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'd', submitted: false, crewOnSite: [c('e1', '06:00', '20:00')] }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('counts distinct employees + DR count per month', () => {
    const r = buildOvertimeMonthly({
      reports: [
        dr({ id: 'a', crewOnSite: [c('e1', '07:00', '15:00'), c('e2', '07:00', '15:00')] }),
        dr({ id: 'b', date: '2026-04-16', crewOnSite: [c('e1', '07:00', '15:00')] }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(2);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildOvertimeMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      reports: [
        dr({ id: 'mar', date: '2026-03-15', crewOnSite: [c('e1', '07:00', '15:00')] }),
        dr({ id: 'apr', date: '2026-04-15', crewOnSite: [c('e1', '07:00', '15:00')] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('computes month-over-month change', () => {
    const r = buildOvertimeMonthly({
      reports: [
        // March: 1 × 10-hour shift = 2 hr OT
        dr({ id: 'mar', date: '2026-03-15', crewOnSite: [c('e1', '06:00', '16:00')] }),
        // April: 1 × 12-hour shift = 4 hr OT
        dr({ id: 'apr', date: '2026-04-15', crewOnSite: [c('e1', '06:00', '18:00')] }),
      ],
    });
    expect(r.rollup.monthOverMonthChange).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildOvertimeMonthly({ reports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.monthOverMonthChange).toBe(0);
  });
});
