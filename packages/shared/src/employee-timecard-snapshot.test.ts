import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildEmployeeTimecardSnapshot } from './employee-timecard-snapshot';

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

describe('buildEmployeeTimecardSnapshot', () => {
  it('filters to one employee', () => {
    const r = buildEmployeeTimecardSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      timeCards: [
        tc({ id: 'a', employeeId: 'e1' }),
        tc({ id: 'b', employeeId: 'e2' }),
      ],
    });
    expect(r.totalCards).toBe(1);
  });

  it('counts ytd', () => {
    const r = buildEmployeeTimecardSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      logYear: 2026,
      timeCards: [
        tc({ id: 'a', weekStarting: '2025-04-14' }),
        tc({ id: 'b', weekStarting: '2026-04-13' }),
      ],
    });
    expect(r.ytdCards).toBe(1);
  });

  it('sums total + daily OT', () => {
    const r = buildEmployeeTimecardSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '18:00' }],
        }),
      ],
    });
    expect(r.totalHours).toBe(12);
    expect(r.dailyOvertimeHours).toBe(4);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeTimecardSnapshot({ employeeId: 'X', timeCards: [] });
    expect(r.totalCards).toBe(0);
    expect(r.lastWeekStarting).toBeNull();
  });
});
