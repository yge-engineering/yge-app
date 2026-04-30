import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildEmployeeCustomerYoy } from './employee-customer-yoy';

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

describe('buildEmployeeCustomerYoy', () => {
  it('compares two years of customer touches for one employee', () => {
    const r = buildEmployeeCustomerYoy({
      employeeId: 'e1',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE')],
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2025-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
        tc({
          id: 'b',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'j2', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctCustomers).toBe(1);
    expect(r.currentDistinctCustomers).toBe(2);
    expect(r.customersDelta).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeCustomerYoy({
      employeeId: 'X',
      currentYear: 2026,
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctCustomers).toBe(0);
  });
});
