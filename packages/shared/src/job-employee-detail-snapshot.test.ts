import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildJobEmployeeDetailSnapshot } from './job-employee-detail-snapshot';

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

describe('buildJobEmployeeDetailSnapshot', () => {
  it('returns one row per employee sorted by hours', () => {
    const r = buildJobEmployeeDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
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
    expect(r.rows[0]?.hoursOnJob).toBe(10);
  });

  it('handles unknown job', () => {
    const r = buildJobEmployeeDetailSnapshot({
      jobId: 'X',
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
