import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildJobOvertimeSnapshot } from './job-overtime-snapshot';

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

describe('buildJobOvertimeSnapshot', () => {
  it('attributes daily OT proportional to job hours', () => {
    const r = buildJobOvertimeSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '14:00' }, // 8h
            { date: '2026-04-13', jobId: 'jX', startTime: '14:00', endTime: '18:00' }, // 4h -> 4 daily OT
          ],
        }),
      ],
    });
    expect(r.hoursOnJob).toBe(8);
    expect(r.dailyOvertimeHours).toBeCloseTo(2.67, 1);
  });

  it('counts cards with OT', () => {
    const r = buildJobOvertimeSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '18:00' }],
        }),
      ],
    });
    expect(r.cardsWithOvertime).toBe(1);
  });

  it('handles unknown job', () => {
    const r = buildJobOvertimeSnapshot({ jobId: 'X', timeCards: [] });
    expect(r.cardsTouchingJob).toBe(0);
  });
});
