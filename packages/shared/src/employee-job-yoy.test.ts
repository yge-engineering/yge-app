import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildEmployeeJobYoy } from './employee-job-yoy';

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

describe('buildEmployeeJobYoy', () => {
  it('compares two years for one employee', () => {
    const r = buildEmployeeJobYoy({
      employeeId: 'e1',
      currentYear: 2026,
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2025-04-13', jobId: 'jA', startTime: '07:00', endTime: '15:00' },
          ],
        }),
        tc({
          id: 'b',
          entries: [
            { date: '2026-04-13', jobId: 'jA', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-14', jobId: 'jB', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctJobs).toBe(1);
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.jobsDelta).toBe(1);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeJobYoy({
      employeeId: 'X',
      currentYear: 2026,
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctJobs).toBe(0);
  });
});
