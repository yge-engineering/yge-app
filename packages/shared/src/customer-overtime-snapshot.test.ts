import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerOvertimeSnapshot } from './customer-overtime-snapshot';

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
    entries: [],
    ...over,
  } as TimeCard;
}

describe('buildCustomerOvertimeSnapshot', () => {
  it('attributes daily OT proportional to customer hours', () => {
    const r = buildCustomerOvertimeSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '14:00' }, // 8h on j1
            { date: '2026-04-13', jobId: 'jX', startTime: '14:00', endTime: '18:00' }, // 4h on jX -> 4h daily OT
          ],
        }),
      ],
    });
    expect(r.hoursOnCustomer).toBe(8);
    // 4 daily OT × (8/12) ≈ 2.67
    expect(r.dailyOvertimeHours).toBeCloseTo(2.67, 1);
  });

  it('counts cards touching customer', () => {
    const r = buildCustomerOvertimeSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      timeCards: [
        tc({
          id: 'a',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
        }),
        tc({
          id: 'b',
          entries: [{ date: '2026-04-13', jobId: 'jX', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.cardsTouchingCustomer).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerOvertimeSnapshot({ customerName: 'X', jobs: [], timeCards: [] });
    expect(r.cardsTouchingCustomer).toBe(0);
  });
});
