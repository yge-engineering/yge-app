import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { TimeCard } from './time-card';

import { buildCustomerTimecardDetailSnapshot } from './customer-timecard-detail-snapshot';

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

describe('buildCustomerTimecardDetailSnapshot', () => {
  it('returns one row per job sorted by hours', () => {
    const r = buildCustomerTimecardDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'j2', startTime: '07:00', endTime: '11:00' },
          ],
        }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.hours).toBe(8);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.hours).toBe(4);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerTimecardDetailSnapshot({
      customerName: 'X',
      jobs: [],
      timeCards: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
