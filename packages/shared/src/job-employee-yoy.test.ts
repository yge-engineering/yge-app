import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildJobEmployeeYoy } from './job-employee-yoy';

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

describe('buildJobEmployeeYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobEmployeeYoy({
      jobId: 'j1',
      currentYear: 2026,
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [{ date: '2025-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:00' }],
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
    expect(r.priorDistinctEmployees).toBe(1);
    expect(r.currentDistinctEmployees).toBe(1);
    expect(r.priorTotalHours).toBe(8);
    expect(r.currentTotalHours).toBe(10);
  });

  it('handles unknown job', () => {
    const r = buildJobEmployeeYoy({
      jobId: 'X',
      currentYear: 2026,
      timeCards: [],
      dailyReports: [],
      dispatches: [],
    });
    expect(r.priorDistinctEmployees).toBe(0);
  });
});
