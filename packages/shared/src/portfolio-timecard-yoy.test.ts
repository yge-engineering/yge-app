import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioTimecardYoy } from './portfolio-timecard-yoy';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '07:00',
    endTime: '15:30',
    lunchOut: '11:30',
    lunchIn: '12:00',
    ...over,
  } as TimeEntry;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    entries: [entry({})],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

describe('buildPortfolioTimecardYoy', () => {
  it('compares prior vs current hours + delta', () => {
    const r = buildPortfolioTimecardYoy({
      currentYear: 2026,
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2025-04-15' }),
            entry({ date: '2026-04-15' }),
            entry({ date: '2026-04-16' }),
          ],
        }),
      ],
    });
    expect(r.priorTotalHours).toBe(8);
    expect(r.currentTotalHours).toBe(16);
    expect(r.totalHoursDelta).toBe(8);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioTimecardYoy({
      currentYear: 2026,
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ jobId: 'j2' })] }),
      ],
    });
    expect(r.currentDistinctEmployees).toBe(2);
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioTimecardYoy({ currentYear: 2026, timecards: [] });
    expect(r.currentTotalHours).toBe(0);
  });
});
