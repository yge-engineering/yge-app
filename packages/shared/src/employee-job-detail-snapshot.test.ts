import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildEmployeeJobDetailSnapshot } from './employee-job-detail-snapshot';

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

describe('buildEmployeeJobDetailSnapshot', () => {
  it('returns one row per job sorted by hours', () => {
    const r = buildEmployeeJobDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'jA', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'jB', startTime: '07:00', endTime: '17:00' },
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('jB');
    expect(r.rows[0]?.hoursOnJob).toBe(10);
    expect(r.rows[1]?.jobId).toBe('jA');
    expect(r.rows[1]?.hoursOnJob).toBe(8);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeJobDetailSnapshot({
      employeeId: 'X',
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
