import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildPortfolioTimecardSnapshot } from './portfolio-timecard-snapshot';

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '',
    updatedAt: '',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    status: 'SUBMITTED',
    entries: [
      { date: '2026-04-13', jobId: 'j1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
    ],
    ...over,
  } as TimeCard;
}

describe('buildPortfolioTimecardSnapshot', () => {
  it('counts cards + ytd', () => {
    const r = buildPortfolioTimecardSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      timeCards: [
        tc({ id: 'a', weekStarting: '2025-04-14' }),
        tc({ id: 'b', weekStarting: '2026-04-13' }),
      ],
    });
    expect(r.totalCards).toBe(2);
    expect(r.ytdCards).toBe(1);
  });

  it('breaks down by status', () => {
    const r = buildPortfolioTimecardSnapshot({
      asOf: '2026-04-30',
      timeCards: [
        tc({ id: 'a', status: 'DRAFT' }),
        tc({ id: 'b', status: 'SUBMITTED' }),
        tc({ id: 'c', status: 'APPROVED' }),
      ],
    });
    expect(r.byStatus.DRAFT).toBe(1);
    expect(r.byStatus.SUBMITTED).toBe(1);
    expect(r.byStatus.APPROVED).toBe(1);
  });

  it('sums total + daily OT', () => {
    const r = buildPortfolioTimecardSnapshot({
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [
            { date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '18:00' },
          ],
        }),
      ],
    });
    expect(r.totalHours).toBe(12);
    expect(r.dailyOvertimeHours).toBe(4);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioTimecardSnapshot({
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
          entries: [{ date: '2026-04-13', jobId: 'j2', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores cards after asOf', () => {
    const r = buildPortfolioTimecardSnapshot({
      asOf: '2026-04-30',
      timeCards: [tc({ id: 'late', weekStarting: '2026-05-04' })],
    });
    expect(r.totalCards).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioTimecardSnapshot({ timeCards: [] });
    expect(r.totalCards).toBe(0);
  });
});
