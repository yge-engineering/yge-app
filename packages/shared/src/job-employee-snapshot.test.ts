import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { buildJobEmployeeSnapshot } from './job-employee-snapshot';

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    status: 'SUBMITTED',
    entries: [],
    ...over,
  } as TimeCard;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    weather: undefined,
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function dp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    scheduledFor: '2026-04-15',
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildJobEmployeeSnapshot', () => {
  it('rolls up per-employee hours from timecards', () => {
    const r = buildJobEmployeeSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          employeeId: 'e1',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'j1', startTime: '07:00', endTime: '11:00' },
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows[0]?.hoursOnJob).toBe(12);
  });

  it('aggregates across all 3 sources', () => {
    const r = buildJobEmployeeSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      timeCards: [
        tc({ employeeId: 'e1', entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dailyReports: [
        dr({ jobId: 'j1', foremanId: 'fm1', crewOnSite: [{ employeeId: 'e2', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dispatches: [
        dp({ jobId: 'j1', crew: [{ employeeId: 'e3', name: 'X' }] }),
      ],
    });
    // e1, e2, fm1, e3 = 4
    expect(r.totalEmployees).toBe(4);
  });

  it('handles unknown job', () => {
    const r = buildJobEmployeeSnapshot({
      jobId: 'X',
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.totalEmployees).toBe(0);
  });
});
