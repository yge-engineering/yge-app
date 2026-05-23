import { describe, it, expect } from 'vitest';
import {
  attentionRows,
  projectOvertime,
} from './overtime-projection';
import type { TimeCard, TimeEntry } from './time-card';

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    date: '2026-05-18',
    jobId: 'job-1',
    startTime: '07:00',
    endTime: '15:30',
    lunchOut: '11:00',
    lunchIn: '11:30',
    ...over,
  } as TimeEntry;
}

function card(over: Partial<TimeCard> = {}): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-05-18T00:00:00Z',
    updatedAt: '2026-05-18T00:00:00Z',
    employeeId: 'e1',
    weekStarting: '2026-05-18',
    entries: [],
    status: 'DRAFT',
    ...over,
  } as TimeCard;
}

describe('projectOvertime — on track', () => {
  it('Wednesday with 24h logged + 16h projected = 40h ON_TRACK', () => {
    // Mon, Tue, Wed each 8h
    const c = card({
      entries: [
        entry({ date: '2026-05-18' }),
        entry({ date: '2026-05-19' }),
        entry({ date: '2026-05-20' }),
      ],
    });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-20',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.hoursWorkedSoFar).toBe(24);
    // Remaining workdays after Wed = Thu, Fri = 2 × 8 = 16
    expect(rows[0]!.projectedHoursThisWeek).toBe(40);
    expect(rows[0]!.flag).toBe('ON_TRACK');
  });
});

describe('projectOvertime — flags', () => {
  it('WILL_HIT_WEEKLY when projected > 40', () => {
    // Mon 10h, Tue 10h, Wed 10h = 30h; +2 days × 8h = 46h projected.
    // But longestDayHours = 10 > 8 → triggers DAILY_OT_TODAY first.
    // To isolate WILL_HIT_WEEKLY without daily OT, do 8h days but more of them.
    const c = card({
      entries: [
        entry({ date: '2026-05-18' }), // Mon 8
        entry({ date: '2026-05-19' }), // Tue 8
        entry({ date: '2026-05-20' }), // Wed 8
        entry({ date: '2026-05-21' }), // Thu 8 (already-logged Thursday work)
      ],
    });
    // As of Thursday: 32h logged, +1 workday × 8 = 40h projected → ON_TRACK
    // Increase the daily forecast to push it over.
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-21', // Thu
      dailyHoursForecast: 10,
    });
    // Projected: 32 + 1×10 = 42 → WILL_HIT_WEEKLY
    expect(rows[0]!.flag).toBe('WILL_HIT_WEEKLY');
  });

  it('DAILY_OT_TODAY when any single day > 8 h', () => {
    const c = card({
      entries: [
        // 10h Mon
        entry({ date: '2026-05-18', startTime: '06:00', endTime: '17:00', lunchOut: '11:00', lunchIn: '12:00' }),
      ],
    });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-18',
    });
    expect(rows[0]!.longestDayHours).toBe(10);
    expect(rows[0]!.flag).toBe('DAILY_OT_TODAY');
  });

  it('DOUBLE_TIME_TODAY when any single day > 12 h', () => {
    const c = card({
      entries: [
        // 14h Mon
        entry({ date: '2026-05-18', startTime: '05:00', endTime: '19:00', lunchOut: undefined, lunchIn: undefined }),
      ],
    });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-18',
    });
    expect(rows[0]!.longestDayHours).toBe(14);
    expect(rows[0]!.flag).toBe('DOUBLE_TIME_TODAY');
  });

  it('ALREADY_OVER_WEEKLY when weekly straight > 40 without daily OT', () => {
    const c = card({
      entries: [
        entry({ date: '2026-05-18' }), // 8
        entry({ date: '2026-05-19' }), // 8
        entry({ date: '2026-05-20' }), // 8
        entry({ date: '2026-05-21' }), // 8
        entry({ date: '2026-05-22' }), // 8
        // Sat overtime (no daily-OT flag because each day ≤ 8)
        entry({ date: '2026-05-23' }), // 8
      ],
    });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-23',
    });
    expect(rows[0]!.hoursWorkedSoFar).toBe(48);
    expect(rows[0]!.flag).toBe('ALREADY_OVER_WEEKLY');
  });

  it('ignores future-dated entries (defensive)', () => {
    const c = card({
      entries: [
        entry({ date: '2026-05-25' }), // future
      ],
    });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-18',
    });
    expect(rows[0]!.hoursWorkedSoFar).toBe(0);
  });

  it('ignores time cards for a different week', () => {
    const c = card({ weekStarting: '2026-05-11', entries: [entry({})] });
    const rows = projectOvertime({
      timeCards: [c],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-18',
    });
    expect(rows).toHaveLength(0);
  });
});

describe('attentionRows', () => {
  it('filters out ON_TRACK rows', () => {
    const ok = card({ employeeId: 'e1', entries: [entry({ date: '2026-05-18' })] });
    const overtime = card({
      id: 'tc-2',
      employeeId: 'e2',
      entries: [
        entry({ date: '2026-05-18', startTime: '06:00', endTime: '20:00', lunchOut: undefined, lunchIn: undefined }),
      ],
    });
    const rows = projectOvertime({
      timeCards: [ok, overtime],
      weekStarting: '2026-05-18',
      asOfDate: '2026-05-18',
    });
    const attn = attentionRows(rows);
    expect(attn.map((r) => r.employeeId)).toEqual(['e2']);
  });
});
