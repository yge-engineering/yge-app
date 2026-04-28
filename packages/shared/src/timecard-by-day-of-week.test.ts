import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildTimecardByDayOfWeek } from './timecard-by-day-of-week';

function card(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    entries: [],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15', // Wednesday
    jobId: 'j1',
    startTime: '08:00',
    endTime: '16:00',
    ...over,
  } as TimeEntry;
}

describe('buildTimecardByDayOfWeek', () => {
  it('groups entries by UTC day of week', () => {
    // 04-13 = Mon, 04-15 = Wed
    const r = buildTimecardByDayOfWeek({
      timeCards: [card({
        entries: [
          entry({ date: '2026-04-13' }),
          entry({ date: '2026-04-15' }),
        ],
      })],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Wednesday']);
  });

  it('sums hours per day of week', () => {
    // 8h on Wed (08:00-16:00 with no lunch)
    const r = buildTimecardByDayOfWeek({
      timeCards: [card({
        entries: [
          entry({ date: '2026-04-15', startTime: '08:00', endTime: '16:00' }),
          entry({ date: '2026-04-15', startTime: '17:00', endTime: '19:00' }),
        ],
      })],
    });
    expect(r.rows[0]?.totalHours).toBe(10);
  });

  it('counts distinct employees, dates, jobs, entries', () => {
    const r = buildTimecardByDayOfWeek({
      timeCards: [
        card({ id: 'a', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
        card({ id: 'b', employeeId: 'e2', entries: [entry({ jobId: 'j2' })] }),
        card({ id: 'c', employeeId: 'e1', entries: [entry({ date: '2026-04-22', jobId: 'j1' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.entryCount).toBe(3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildTimecardByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      timeCards: [card({
        entries: [
          entry({ date: '2026-04-13' }),
          entry({ date: '2026-04-15' }),
        ],
      })],
    });
    expect(r.rollup.totalEntries).toBe(1);
  });

  it('computes avg hours per employee-day', () => {
    // Both employees worked 8h on Wed
    const r = buildTimecardByDayOfWeek({
      timeCards: [
        card({ id: 'a', employeeId: 'e1', entries: [entry({ date: '2026-04-15' })] }),
        card({ id: 'b', employeeId: 'e2', entries: [entry({ date: '2026-04-15' })] }),
      ],
    });
    expect(r.rows[0]?.avgHoursPerEmployeeDay).toBe(8);
  });

  it('sorts Monday-first', () => {
    const r = buildTimecardByDayOfWeek({
      timeCards: [card({
        entries: [
          entry({ date: '2026-04-19' }), // Sunday
          entry({ date: '2026-04-13' }), // Monday
          entry({ date: '2026-04-18' }), // Saturday
        ],
      })],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Saturday', 'Sunday']);
  });

  it('handles empty input', () => {
    const r = buildTimecardByDayOfWeek({ timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
