import { describe, expect, it } from 'vitest';

import type { TimeCard, TimeEntry } from './time-card';

import { buildEmployeeOvertimeMonthly } from './employee-overtime-monthly';

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

describe('buildEmployeeOvertimeMonthly', () => {
  it('groups by (employee, month)', () => {
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [
        card({ id: 'a', employeeId: 'e1', weekStarting: '2026-03-30', entries: [entry({})] }),
        card({ id: 'b', employeeId: 'e1', weekStarting: '2026-04-13', entries: [entry({})] }),
        card({ id: 'c', employeeId: 'e2', weekStarting: '2026-04-13', entries: [entry({})] }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('captures daily OT', () => {
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [
        card({
          entries: [entry({ startTime: '08:00', endTime: '20:00' })], // 12h → 4 OT
        }),
      ],
    });
    expect(r.rows[0]?.dailyOvertimeHours).toBe(4);
    expect(r.rows[0]?.overtimeHoursTotal).toBe(4);
  });

  it('captures weekly OT', () => {
    // Six 8h days → 48h total, 0 daily, 8 weekly OT
    const days = ['2026-04-13','2026-04-14','2026-04-15','2026-04-16','2026-04-17','2026-04-18'];
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [card({ entries: days.map((d) => entry({ date: d })) })],
    });
    expect(r.rows[0]?.weeklyOvertimeHours).toBe(8);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildEmployeeOvertimeMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      timeCards: [
        card({ id: 'mar', weekStarting: '2026-03-30', entries: [entry({})] }),
        card({ id: 'apr', weekStarting: '2026-04-13', entries: [entry({})] }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('counts cards per (employee, month)', () => {
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [
        card({ id: 'a', weekStarting: '2026-04-06', entries: [entry({})] }),
        card({ id: 'b', weekStarting: '2026-04-13', entries: [entry({})] }),
      ],
    });
    expect(r.rows[0]?.cardsCounted).toBe(2);
  });

  it('sorts by employeeId asc, month asc', () => {
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [
        card({ id: 'z', employeeId: 'Z', entries: [entry({})] }),
        card({ id: 'a', employeeId: 'A', entries: [entry({})] }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('A');
  });

  it('rolls up portfolio OT', () => {
    const r = buildEmployeeOvertimeMonthly({
      timeCards: [card({ entries: [entry({ startTime: '08:00', endTime: '20:00' })] })],
    });
    expect(r.rollup.overtimeHoursTotal).toBe(4);
  });

  it('handles empty input', () => {
    const r = buildEmployeeOvertimeMonthly({ timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
