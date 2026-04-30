import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerEmployeeYoy } from './customer-employee-yoy';

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

describe('buildCustomerEmployeeYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerEmployeeYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [{ date: '2025-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
        }),
        tc({
          id: 'b',
          employeeId: 'e2',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '17:00' }],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctEmployees).toBe(1);
    expect(r.currentDistinctEmployees).toBe(1);
    expect(r.priorTotalHours).toBe(8);
    expect(r.currentTotalHours).toBe(10);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEmployeeYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctEmployees).toBe(0);
  });
});
