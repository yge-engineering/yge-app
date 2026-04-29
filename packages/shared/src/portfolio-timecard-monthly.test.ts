import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioTimecardMonthly } from './portfolio-timecard-monthly';

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

describe('buildPortfolioTimecardMonthly', () => {
  it('sums worked hours across timecards', () => {
    const r = buildPortfolioTimecardMonthly({
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({}),
            entry({}),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.entries).toBe(2);
    expect(r.rows[0]?.totalHours).toBe(16);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioTimecardMonthly({
      timecards: [
        tc({ id: 'a', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
        tc({ id: 'b', employeeId: 'e2', entries: [entry({ jobId: 'j2' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioTimecardMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioTimecardMonthly({
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-06-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioTimecardMonthly({ timecards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
