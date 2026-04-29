import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildPortfolioOvertimeYoy } from './portfolio-overtime-yoy';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '07:00',
    endTime: '17:00',
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
    entries: [],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

describe('buildPortfolioOvertimeYoy', () => {
  it('compares prior vs current OT', () => {
    // 2025-04-16 was Wednesday → 2 OT
    // 2026-04-15 is Wednesday → 2 OT
    const r = buildPortfolioOvertimeYoy({
      currentYear: 2026,
      timecards: [
        tc({ id: 'a', entries: [entry({ date: '2025-04-16' })] }),
        tc({
          id: 'b',
          entries: [
            entry({ date: '2026-04-15' }),
            entry({ date: '2026-04-16' }),
          ],
        }),
      ],
    });
    expect(r.priorTotalOtHours).toBe(2);
    expect(r.currentTotalOtHours).toBe(4);
    expect(r.totalOtDelta).toBe(2);
  });

  it('counts Saturday + Sunday as full OT', () => {
    // 2026-04-18 Saturday, 2026-04-19 Sunday
    const r = buildPortfolioOvertimeYoy({
      currentYear: 2026,
      timecards: [
        tc({
          id: 'a',
          entries: [
            entry({ date: '2026-04-18', startTime: '07:00', endTime: '15:00' }),
            entry({ date: '2026-04-19', startTime: '07:00', endTime: '15:00' }),
          ],
        }),
      ],
    });
    expect(r.currentSaturdayOtHours).toBe(8);
    expect(r.currentSundayOtHours).toBe(8);
  });

  it('ignores entries outside the two-year window', () => {
    const r = buildPortfolioOvertimeYoy({
      currentYear: 2026,
      timecards: [
        tc({ id: 'a', entries: [entry({ date: '2024-04-15' })] }),
      ],
    });
    expect(r.priorTotalOtHours).toBe(0);
    expect(r.currentTotalOtHours).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioOvertimeYoy({ currentYear: 2026, timecards: [] });
    expect(r.priorTotalOtHours).toBe(0);
    expect(r.currentTotalOtHours).toBe(0);
  });
});
