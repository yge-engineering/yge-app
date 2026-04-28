import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildOvertimeByClassification } from './overtime-by-classification';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Test',
    lastName: 'Employee',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function card(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'e1',
    weekStarting: '2026-04-06',
    entries: [],
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-06',
    jobId: 'j1',
    startTime: '08:00',
    endTime: '16:00',
    ...over,
  } as TimeEntry;
}

describe('buildOvertimeByClassification', () => {
  it('groups time cards by the employee classification', () => {
    const r = buildOvertimeByClassification({
      employees: [
        emp({ id: 'op', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'lab', classification: 'LABORER_GROUP_1' }),
      ],
      timeCards: [
        card({ id: 'c1', employeeId: 'op', entries: [entry({})] }),
        card({ id: 'c2', employeeId: 'lab', entries: [entry({})] }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('captures daily OT (hours over 8 in a day)', () => {
    const r = buildOvertimeByClassification({
      employees: [emp({ id: 'lab' })],
      timeCards: [
        card({
          employeeId: 'lab',
          entries: [
            entry({ date: '2026-04-06', startTime: '08:00', endTime: '20:00' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.dailyOvertimeHours).toBe(4);
    expect(r.rows[0]?.weeklyOvertimeHours).toBe(0);
    expect(r.rows[0]?.overtimeHoursTotal).toBe(4);
  });

  it('captures weekly OT (hours over 40 once daily OT is removed)', () => {
    // Six 8-hour days → 48 total, 0 daily, 8 weekly OT
    const days = ['2026-04-06','2026-04-07','2026-04-08','2026-04-09','2026-04-10','2026-04-11'];
    const r = buildOvertimeByClassification({
      employees: [emp({ id: 'lab' })],
      timeCards: [
        card({
          employeeId: 'lab',
          entries: days.map((d) => entry({ date: d })),
        }),
      ],
    });
    expect(r.rows[0]?.dailyOvertimeHours).toBe(0);
    expect(r.rows[0]?.weeklyOvertimeHours).toBe(8);
    expect(r.rows[0]?.totalHours).toBe(48);
  });

  it('respects fromWeek / toWeek window', () => {
    const r = buildOvertimeByClassification({
      fromWeek: '2026-04-06',
      toWeek: '2026-04-06',
      employees: [emp({ id: 'lab' })],
      timeCards: [
        card({ id: 'old', employeeId: 'lab', weekStarting: '2026-03-30', entries: [entry({})] }),
        card({ id: 'in', employeeId: 'lab', weekStarting: '2026-04-06', entries: [entry({})] }),
      ],
    });
    expect(r.rows[0]?.cardsConsidered).toBe(1);
  });

  it('counts distinct employees per classification', () => {
    const r = buildOvertimeByClassification({
      employees: [
        emp({ id: 'a', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'b', classification: 'LABORER_GROUP_1' }),
      ],
      timeCards: [
        card({ id: 'c1', employeeId: 'a', entries: [entry({})] }),
        card({ id: 'c2', employeeId: 'b', entries: [entry({})] }),
        card({ id: 'c3', employeeId: 'a', weekStarting: '2026-04-13', entries: [entry({ date: '2026-04-13' })] }),
      ],
    });
    expect(r.rows[0]?.employeesConsidered).toBe(2);
    expect(r.rows[0]?.cardsConsidered).toBe(3);
  });

  it('defaults missing employee record to NOT_APPLICABLE', () => {
    const r = buildOvertimeByClassification({
      employees: [],
      timeCards: [card({ employeeId: 'unknown', entries: [entry({})] })],
    });
    expect(r.rows[0]?.classification).toBe('NOT_APPLICABLE');
  });

  it('sorts by overtimeHoursTotal desc', () => {
    const r = buildOvertimeByClassification({
      employees: [
        emp({ id: 'op', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'lab', classification: 'LABORER_GROUP_1' }),
      ],
      timeCards: [
        // Operator has 1 hour daily OT, laborer has 4 hours daily OT
        card({
          employeeId: 'op',
          entries: [entry({ startTime: '08:00', endTime: '17:00' })], // 9h → 1 OT
        }),
        card({
          employeeId: 'lab',
          entries: [entry({ startTime: '08:00', endTime: '20:00' })], // 12h → 4 OT
        }),
      ],
    });
    expect(r.rows[0]?.classification).toBe('LABORER_GROUP_1');
  });

  it('rolls up portfolio totals + share', () => {
    const r = buildOvertimeByClassification({
      employees: [emp({ id: 'lab' })],
      timeCards: [
        card({
          employeeId: 'lab',
          entries: [entry({ startTime: '08:00', endTime: '20:00' })], // 12h, 4 OT
        }),
      ],
    });
    expect(r.rollup.totalHours).toBe(12);
    expect(r.rollup.overtimeHoursTotal).toBe(4);
    expect(r.rollup.portfolioOvertimeShare).toBeCloseTo(0.3333, 3);
  });

  it('handles empty input', () => {
    const r = buildOvertimeByClassification({ employees: [], timeCards: [] });
    expect(r.rows).toHaveLength(0);
  });
});
