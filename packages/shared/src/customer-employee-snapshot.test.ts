import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';
import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerEmployeeSnapshot } from './customer-employee-snapshot';

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
    foremanName: 'Pat',
    scopeOfWork: 'X',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

describe('buildCustomerEmployeeSnapshot', () => {
  it('counts distinct employees from all 3 sources', () => {
    const r = buildCustomerEmployeeSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      timeCards: [
        tc({
          employeeId: 'e1',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
      dailyReports: [
        dr({ jobId: 'j1', foremanId: 'fm1', crewOnSite: [{ employeeId: 'e2', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dispatches: [
        dp({ jobId: 'j1', crew: [{ employeeId: 'e3', name: 'X' }] }),
      ],
    });
    // e1, e2, e3, fm1 = 4
    expect(r.distinctEmployees).toBe(4);
    expect(r.totalHoursOnCustomer).toBe(8);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEmployeeSnapshot({
      customerName: 'X',
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.distinctEmployees).toBe(0);
  });
});
