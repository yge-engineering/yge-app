import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerTimecardYoy } from './customer-timecard-yoy';

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

describe('buildCustomerTimecardYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerTimecardYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      timeCards: [
        tc({
          id: 'a',
          weekStarting: '2025-04-14',
          entries: [{ date: '2025-04-14', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
        }),
        tc({
          id: 'b',
          weekStarting: '2026-04-13',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '17:00' }],
        }),
      ],
    });
    expect(r.priorHoursOnCustomer).toBe(8);
    expect(r.currentHoursOnCustomer).toBe(10);
    expect(r.hoursDelta).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerTimecardYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      timeCards: [],
    });
    expect(r.priorHoursOnCustomer).toBe(0);
  });
});
