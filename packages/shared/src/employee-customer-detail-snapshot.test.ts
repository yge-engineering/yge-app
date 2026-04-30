import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildEmployeeCustomerDetailSnapshot } from './employee-customer-detail-snapshot';

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

describe('buildEmployeeCustomerDetailSnapshot', () => {
  it('returns one row per customer sorted by hours', () => {
    const r = buildEmployeeCustomerDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'CAL FIRE')],
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'j2', startTime: '07:00', endTime: '17:00' },
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.customerName).toBe('CAL FIRE');
    expect(r.rows[0]?.hours).toBe(10);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeCustomerDetailSnapshot({
      employeeId: 'X',
      jobs: [],
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
