import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildEmployeeOvertimeByJob } from './employee-overtime-by-job';

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

describe('buildEmployeeOvertimeByJob', () => {
  it('groups by (employee, job)', () => {
    const r = buildEmployeeOvertimeByJob({
      timeCards: [card({
        entries: [
          entry({ jobId: 'j1' }),
          entry({ date: '2026-04-16', jobId: 'j2' }),
        ],
      })],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('prorates daily OT to job by share of card hours', () => {
    // Single 12h day: 8h on j1, 4h on j2. Daily OT = 4. Reg = 8.
    // Pro-rata: j1 = 8/12 share of 4 OT = 2.67. j2 = 4/12 share = 1.33.
    const r = buildEmployeeOvertimeByJob({
      timeCards: [card({
        entries: [
          entry({ jobId: 'j1', startTime: '08:00', endTime: '16:00' }),
          entry({ jobId: 'j2', startTime: '16:00', endTime: '20:00' }),
        ],
      })],
    });
    const j1 = r.rows.find((x) => x.jobId === 'j1');
    const j2 = r.rows.find((x) => x.jobId === 'j2');
    expect(j1?.dailyOvertimeHours).toBeCloseTo(2.67, 1);
    expect(j2?.dailyOvertimeHours).toBeCloseTo(1.33, 1);
  });

  it('prorates regular hours to job', () => {
    const r = buildEmployeeOvertimeByJob({
      timeCards: [card({
        entries: [entry({ jobId: 'j1', startTime: '08:00', endTime: '16:00' })],
      })],
    });
    expect(r.rows[0]?.regularHours).toBe(8);
    expect(r.rows[0]?.overtimeHoursTotal).toBe(0);
  });

  it('handles weekly OT prorate', () => {
    // Six 8h days on j1 = 48h, 8h weekly OT. All to j1.
    const days = ['2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-18'];
    const r = buildEmployeeOvertimeByJob({
      timeCards: [card({ entries: days.map((d) => entry({ date: d })) })],
    });
    expect(r.rows[0]?.weeklyOvertimeHours).toBe(8);
    expect(r.rows[0]?.regularHours).toBe(40);
  });

  it('respects fromWeek / toWeek bounds', () => {
    const r = buildEmployeeOvertimeByJob({
      fromWeek: '2026-04-13',
      toWeek: '2026-04-13',
      timeCards: [
        card({ id: 'old', weekStarting: '2026-04-06', entries: [entry({})] }),
        card({ id: 'in', weekStarting: '2026-04-13', entries: [entry({})] }),
      ],
    });
    expect(r.rollup.employeesConsidered).toBe(1);
  });

  it('sorts by employeeId asc, overtime desc within employee', () => {
    const r = buildEmployeeOvertimeByJob({
      timeCards: [card({
        entries: [
          entry({ jobId: 'small', startTime: '08:00', endTime: '17:00' }),
        ],
      })],
    });
    expect(r.rows[0]?.jobId).toBe('small');
  });

  it('handles empty input', () => {
    const r = buildEmployeeOvertimeByJob({ timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
