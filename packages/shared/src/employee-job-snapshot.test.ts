import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { TimeCard } from './time-card';

import { buildEmployeeJobSnapshot } from './employee-job-snapshot';

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

describe('buildEmployeeJobSnapshot', () => {
  it('counts jobs from all three sources', () => {
    const r = buildEmployeeJobSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          employeeId: 'e1',
          entries: [{ date: '2026-04-13', jobId: 'jA', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
      dailyReports: [
        dr({ jobId: 'jB', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dispatches: [
        dp({ jobId: 'jC', crew: [{ employeeId: 'e1', name: 'Pat' }], foremanName: 'Sam' }),
      ],
    });
    expect(r.jobsViaTimeCards).toBe(1);
    expect(r.jobsViaDailyReports).toBe(1);
    expect(r.jobsViaDispatches).toBe(1);
    expect(r.distinctJobs).toBe(3);
    expect(r.totalHoursAllJobs).toBe(8);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeJobSnapshot({
      employeeId: 'X',
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.distinctJobs).toBe(0);
    expect(r.lastAppearanceDate).toBeNull();
  });
});
