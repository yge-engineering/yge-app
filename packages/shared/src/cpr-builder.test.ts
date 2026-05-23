import { describe, it, expect } from 'vitest';
import {
  buildDraftCprRows,
  splitOvertime,
} from './cpr-builder';
import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

function emp(over: Partial<Employee> = {}): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    firstName: 'Sam',
    lastName: 'Smith',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    classificationNote: undefined,
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function entry(over: Partial<TimeEntry> = {}): TimeEntry {
  return {
    date: '2026-05-18', // Monday
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

describe('splitOvertime — CA §510', () => {
  it('all-straight when every day ≤ 8 and weekly ≤ 40', () => {
    const r = splitOvertime([8, 8, 8, 8, 8, 0, 0]);
    expect(r).toEqual({ straight: 40, overtime: 0, doubleTime: 0 });
  });

  it('daily 8-12 spills into OT', () => {
    const r = splitOvertime([10, 8, 8, 8, 8, 0, 0]); // 2 OT on Mon
    expect(r).toEqual({ straight: 40, overtime: 2, doubleTime: 0 });
  });

  it('daily > 12 spills into double time', () => {
    const r = splitOvertime([14, 0, 0, 0, 0, 0, 0]); // 8 ST + 4 OT + 2 DT
    expect(r).toEqual({ straight: 8, overtime: 4, doubleTime: 2 });
  });

  it('weekly > 40 with no daily > 8 still produces OT', () => {
    const r = splitOvertime([8, 8, 8, 8, 8, 8, 0]); // 48 h, 8 OT
    expect(r).toEqual({ straight: 40, overtime: 8, doubleTime: 0 });
  });

  it('handles a quiet week', () => {
    const r = splitOvertime([0, 0, 0, 0, 0, 0, 0]);
    expect(r).toEqual({ straight: 0, overtime: 0, doubleTime: 0 });
  });
});

describe('buildDraftCprRows', () => {
  it('rolls up Mon-Fri entries for one employee on the target job', () => {
    const e = emp();
    const c = card({
      entries: [
        // Mon 8h, Tue 8h, Wed 8h, Thu 8h, Fri 8h = 40h straight
        entry({ date: '2026-05-18' }), // Mon — 8h
        entry({ date: '2026-05-19' }), // Tue
        entry({ date: '2026-05-20' }), // Wed
        entry({ date: '2026-05-21' }), // Thu
        entry({ date: '2026-05-22' }), // Fri
      ],
    });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [e],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.dailyHours).toEqual([8, 8, 8, 8, 8, 0, 0]);
    expect(rows[0]!.straightHours).toBe(40);
    expect(rows[0]!.overtimeHours).toBe(0);
    expect(rows[0]!.doubleTimeHours).toBe(0);
    expect(rows[0]!.hasOtherJobHours).toBe(false);
  });

  it('ignores time-card entries for OTHER jobs but flags hasOtherJobHours', () => {
    const e = emp();
    const c = card({
      entries: [
        entry({ date: '2026-05-18', jobId: 'job-1' }),
        entry({ date: '2026-05-19', jobId: 'job-2' }), // other job
      ],
    });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [e],
    });
    expect(rows[0]!.dailyHours).toEqual([8, 0, 0, 0, 0, 0, 0]);
    expect(rows[0]!.hasOtherJobHours).toBe(true);
  });

  it('ignores time cards for a different week', () => {
    const e = emp();
    const c = card({ weekStarting: '2026-05-11' });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [e],
    });
    expect(rows).toHaveLength(0);
  });

  it('skips employees not in the roster (orphaned time cards)', () => {
    const c = card({ employeeId: 'mystery' });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [],
    });
    expect(rows).toHaveLength(0);
  });

  it('sorts rows by lastName, firstName', () => {
    const e1 = emp({ id: 'e1', lastName: 'Zane', firstName: 'A' });
    const e2 = emp({ id: 'e2', lastName: 'Aaron', firstName: 'B' });
    const c1 = card({ employeeId: 'e1', entries: [entry({})] });
    const c2 = card({ id: 'tc-2', employeeId: 'e2', entries: [entry({})] });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c1, c2],
      employees: [e1, e2],
    });
    expect(rows.map((r) => r.employeeId)).toEqual(['e2', 'e1']);
  });

  it('uses displayName when set', () => {
    const e = emp({ displayName: 'Skip' });
    const c = card({ entries: [entry({})] });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [e],
    });
    expect(rows[0]!.name).toBe('Smith, Skip');
  });

  it('splits a 14-hour day into 8 ST + 4 OT + 2 DT', () => {
    const e = emp();
    const c = card({
      entries: [
        entry({ date: '2026-05-18', startTime: '06:00', endTime: '20:00', lunchOut: undefined, lunchIn: undefined }),
      ],
    });
    const rows = buildDraftCprRows({
      jobId: 'job-1',
      weekStarting: '2026-05-18',
      timeCards: [c],
      employees: [e],
    });
    expect(rows[0]!.dailyHours[0]).toBe(14);
    expect(rows[0]!.straightHours).toBe(8);
    expect(rows[0]!.overtimeHours).toBe(4);
    expect(rows[0]!.doubleTimeHours).toBe(2);
  });
});
