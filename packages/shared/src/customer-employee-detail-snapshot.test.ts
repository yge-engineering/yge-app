import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerEmployeeDetailSnapshot } from './customer-employee-detail-snapshot';

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

describe('buildCustomerEmployeeDetailSnapshot', () => {
  it('returns one row per employee sorted by hours', () => {
    const r = buildCustomerEmployeeDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans')],
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
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
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.employeeId).toBe('e2');
    expect(r.rows[0]?.hours).toBe(10);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerEmployeeDetailSnapshot({
      customerName: 'X',
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
