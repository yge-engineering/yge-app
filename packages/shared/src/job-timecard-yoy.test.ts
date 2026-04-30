import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildJobTimecardYoy } from './job-timecard-yoy';

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

describe('buildJobTimecardYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobTimecardYoy({
      jobId: 'j1',
      currentYear: 2026,
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
    expect(r.priorHoursOnJob).toBe(8);
    expect(r.currentHoursOnJob).toBe(10);
    expect(r.hoursDelta).toBe(2);
  });

  it('handles unknown job', () => {
    const r = buildJobTimecardYoy({ jobId: 'X', currentYear: 2026, timeCards: [] });
    expect(r.priorHoursOnJob).toBe(0);
  });
});
