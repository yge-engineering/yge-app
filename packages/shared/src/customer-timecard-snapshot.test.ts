import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerTimecardSnapshot } from './customer-timecard-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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
    entries: [
      { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
    ],
    ...over,
  } as TimeCard;
}

describe('buildCustomerTimecardSnapshot', () => {
  it('finds cards that touch the customer\'s jobs', () => {
    const r = buildCustomerTimecardSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      timeCards: [
        tc({
          id: 'a',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
        }),
        tc({
          id: 'b',
          entries: [{ date: '2026-04-13', jobId: 'j2', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.cardsTouchingCustomer).toBe(1);
    expect(r.hoursOnCustomer).toBe(8);
  });

  it('sums hours only from customer-job entries', () => {
    const r = buildCustomerTimecardSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '11:00' },
            { date: '2026-04-13', jobId: 'jX', startTime: '11:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.hoursOnCustomer).toBe(4);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerTimecardSnapshot({ customerName: 'X', jobs: [], timeCards: [] });
    expect(r.cardsTouchingCustomer).toBe(0);
  });
});
