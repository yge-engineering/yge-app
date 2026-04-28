import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildTimeCardMonthlyHours } from './timecard-monthly-hours';

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as TimeEntry;
}

function card(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'e1',
    weekStarting: '2026-04-13',
    status: 'SUBMITTED',
    entries: [],
    ...over,
  } as TimeCard;
}

describe('buildTimeCardMonthlyHours', () => {
  it('buckets entries by yyyy-mm of date', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-10' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sums hours via entryWorkedMinutes', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({
          entries: [
            entry({ startTime: '07:00', endTime: '15:00', lunchOut: '12:00', lunchIn: '12:30' }),
          ],
        }),
      ],
    });
    // 8h - 0.5h lunch = 7.5h
    expect(r.rows[0]?.totalHours).toBe(7.5);
  });

  it('counts distinct employees + jobs + cards', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({ id: 't1', employeeId: 'e1', entries: [entry({ jobId: 'j1' })] }),
        card({ id: 't2', employeeId: 'e2', entries: [entry({ jobId: 'j2' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.cardCount).toBe(2);
  });

  it('skips DRAFT cards by default', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({ id: 'd', status: 'DRAFT', entries: [entry({})] }),
        card({ id: 's', status: 'SUBMITTED', entries: [entry({})] }),
      ],
    });
    expect(r.rows[0]?.cardCount).toBe(1);
  });

  it('respects skipDraft=false', () => {
    const r = buildTimeCardMonthlyHours({
      skipDraft: false,
      timeCards: [
        card({ id: 'd', status: 'DRAFT', entries: [entry({})] }),
        card({ id: 's', status: 'SUBMITTED', entries: [entry({})] }),
      ],
    });
    expect(r.rows[0]?.cardCount).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildTimeCardMonthlyHours({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      timeCards: [
        card({
          entries: [
            entry({ date: '2026-03-15' }),
            entry({ date: '2026-04-15' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month hours change', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({
          entries: [
            entry({ date: '2026-03-15', startTime: '07:00', endTime: '15:00' }),
            entry({ date: '2026-04-15', startTime: '06:00', endTime: '16:00' }),
          ],
        }),
      ],
    });
    expect(r.rollup.monthOverMonthHoursChange).toBe(2);
  });

  it('sorts ascending by month', () => {
    const r = buildTimeCardMonthlyHours({
      timeCards: [
        card({
          entries: [
            entry({ date: '2026-04-15' }),
            entry({ date: '2026-02-15' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildTimeCardMonthlyHours({ timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
