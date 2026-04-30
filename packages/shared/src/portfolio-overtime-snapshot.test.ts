import { describe, expect, it } from 'vitest';

import type { TimeCard } from './time-card';

import { buildPortfolioOvertimeSnapshot } from './portfolio-overtime-snapshot';

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

describe('buildPortfolioOvertimeSnapshot', () => {
  it('counts cards + ytd', () => {
    const r = buildPortfolioOvertimeSnapshot({
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

  it('sums daily OT hours', () => {
    const r = buildPortfolioOvertimeSnapshot({
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '18:00' }],
        }),
      ],
    });
    expect(r.totalDailyOt).toBe(4);
    expect(r.cardsWithOvertime).toBe(1);
  });

  it('counts employees with OT vs distinct employees', () => {
    const r = buildPortfolioOvertimeSnapshot({
      asOf: '2026-04-30',
      timeCards: [
        tc({
          id: 'a',
          employeeId: 'e1',
          entries: [{ date: '2026-04-13', jobId: 'j1', startTime: '06:00', endTime: '18:00' }],
        }),
        tc({
          id: 'b',
          employeeId: 'e2',
          entries: [{ date: '2026-04-13', jobId: 'j2', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.employeesWithOt).toBe(1);
  });

  it('ignores cards after asOf', () => {
    const r = buildPortfolioOvertimeSnapshot({
      asOf: '2026-04-30',
      timeCards: [tc({ id: 'late', weekStarting: '2026-05-04' })],
    });
    expect(r.totalCards).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioOvertimeSnapshot({ timeCards: [] });
    expect(r.totalCards).toBe(0);
    expect(r.totalDailyOt).toBe(0);
  });
});
