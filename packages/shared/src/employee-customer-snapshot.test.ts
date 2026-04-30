import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildEmployeeCustomerSnapshot } from './employee-customer-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

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
    foremanName: 'Sam',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildEmployeeCustomerSnapshot', () => {
  it('joins employee-jobs to customers', () => {
    const r = buildEmployeeCustomerSnapshot({
      employeeId: 'e1',
      employeeName: 'Pat',
      asOf: '2026-04-30',
      jobs: [jb('jA', 'Caltrans'), jb('jB', 'CAL FIRE'), jb('jC', 'Caltrans')],
      timeCards: [
        tc({
          employeeId: 'e1',
          entries: [
            { date: '2026-04-13', jobId: 'jA', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'jC', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      dailyReports: [
        dr({ jobId: 'jB', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dispatches: [],
    });
    expect(r.distinctJobs).toBe(3);
    expect(r.distinctCustomers).toBe(2);
    expect(r.customers).toContain('CAL FIRE');
    expect(r.customers).toContain('Caltrans');
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeCustomerSnapshot({
      employeeId: 'X',
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.distinctCustomers).toBe(0);
  });
});
