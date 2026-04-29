import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildTimecardByJobMonthly } from './timecard-by-job-monthly';

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
    date: '2026-04-15',
    jobId: 'j1',
    startTime: '08:00',
    endTime: '16:00',
    ...over,
  } as TimeEntry;
}

describe('buildTimecardByJobMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildTimecardByJobMonthly({
      timeCards: [card({
        entries: [
          entry({ date: '2026-03-15', jobId: 'j1' }),
          entry({ date: '2026-04-15', jobId: 'j1' }),
          entry({ date: '2026-04-15', jobId: 'j2' }),
        ],
      })],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums hours per pair', () => {
    const r = buildTimecardByJobMonthly({
      timeCards: [card({
        entries: [
          entry({ jobId: 'j1', startTime: '08:00', endTime: '12:00' }),
          entry({ jobId: 'j1', startTime: '13:00', endTime: '17:00' }),
        ],
      })],
    });
    expect(r.rows[0]?.totalHours).toBe(8);
  });

  it('counts distinct employees and days', () => {
    const r = buildTimecardByJobMonthly({
      timeCards: [
        card({ id: 'a', employeeId: 'e1', entries: [entry({ date: '2026-04-15' })] }),
        card({ id: 'b', employeeId: 'e2', entries: [entry({ date: '2026-04-16' })] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctDays).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildTimecardByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      timeCards: [card({
        entries: [
          entry({ date: '2026-03-15' }),
          entry({ date: '2026-04-15' }),
        ],
      })],
    });
    expect(r.rollup.jobsConsidered).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildTimecardByJobMonthly({
      timeCards: [card({
        entries: [
          entry({ date: '2026-04-15', jobId: 'Z' }),
          entry({ date: '2026-04-15', jobId: 'A' }),
          entry({ date: '2026-03-15', jobId: 'A' }),
        ],
      })],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildTimecardByJobMonthly({ timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
