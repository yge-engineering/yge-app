import { describe, expect, it } from 'vitest';

import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildJobTimecardHours } from './job-timecard-hours';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'job-1',
    startTime: '07:00',
    endTime: '15:00',
    ...over,
  } as TimeEntry;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'emp-1',
    weekStarting: '2026-04-13',
    entries: [],
    status: 'SUBMITTED',
    ...over,
  } as TimeCard;
}

describe('buildJobTimecardHours', () => {
  it('skips DRAFT and REJECTED time cards', () => {
    const r = buildJobTimecardHours({
      employees: [emp({})],
      timeCards: [
        tc({ id: 'd', status: 'DRAFT', entries: [entry({})] }),
        tc({ id: 'r', status: 'REJECTED', entries: [entry({})] }),
      ],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('rolls up total hours per job', () => {
    const r = buildJobTimecardHours({
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            entry({ jobId: 'job-A', startTime: '07:00', endTime: '15:00' }),
            entry({ jobId: 'job-B', startTime: '07:00', endTime: '11:00' }),
          ],
        }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const a = r.rows.find((x) => x.jobId === 'job-A');
    const b = r.rows.find((x) => x.jobId === 'job-B');
    expect(a?.totalHours).toBe(8);
    expect(b?.totalHours).toBe(4);
  });

  it('breaks hours down by classification', () => {
    const r = buildJobTimecardHours({
      employees: [
        emp({ id: 'e-l', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'e-o', classification: 'OPERATING_ENGINEER_GROUP_2' }),
      ],
      timeCards: [
        tc({
          id: 't1',
          employeeId: 'e-l',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
        tc({
          id: 't2',
          employeeId: 'e-o',
          entries: [entry({ startTime: '06:00', endTime: '15:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.hoursByClassification).toHaveLength(2);
    const labor = r.rows[0]?.hoursByClassification.find(
      (c) => c.classification === 'LABORER_GROUP_1',
    );
    const op = r.rows[0]?.hoursByClassification.find(
      (c) => c.classification === 'OPERATING_ENGINEER_GROUP_2',
    );
    expect(labor?.hours).toBe(8);
    expect(op?.hours).toBe(9);
  });

  it('breaks hours down by employee', () => {
    const r = buildJobTimecardHours({
      employees: [
        emp({ id: 'e1', firstName: 'A', lastName: 'X' }),
        emp({ id: 'e2', firstName: 'B', lastName: 'Y' }),
      ],
      timeCards: [
        tc({
          id: 't1',
          employeeId: 'e1',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
        tc({
          id: 't2',
          employeeId: 'e2',
          entries: [entry({ startTime: '07:00', endTime: '11:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.hoursByEmployee).toHaveLength(2);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('classifies missing-employee entries as OTHER', () => {
    const r = buildJobTimecardHours({
      employees: [],
      timeCards: [
        tc({
          employeeId: 'unknown',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.hoursByClassification[0]?.classification).toBe('OTHER');
  });

  it('respects window bounds', () => {
    const r = buildJobTimecardHours({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            entry({ date: '2026-04-10', startTime: '07:00', endTime: '15:00' }),
            entry({ date: '2026-04-20', startTime: '07:00', endTime: '15:00' }),
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalHours).toBe(8);
  });

  it('counts distinct timecards touching the job', () => {
    const r = buildJobTimecardHours({
      employees: [emp({})],
      timeCards: [
        tc({
          id: 't1',
          entries: [entry({ jobId: 'job-1', startTime: '07:00', endTime: '15:00' })],
        }),
        tc({
          id: 't2',
          entries: [entry({ jobId: 'job-1', startTime: '07:00', endTime: '11:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.timeCardsTouched).toBe(2);
  });

  it('rolls up grand total + sorts highest-hours job first', () => {
    const r = buildJobTimecardHours({
      employees: [emp({})],
      timeCards: [
        tc({
          id: 't-small',
          entries: [entry({ jobId: 'small', startTime: '07:00', endTime: '11:00' })],
        }),
        tc({
          id: 't-big',
          entries: [entry({ jobId: 'big', startTime: '07:00', endTime: '15:00' })],
        }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
    expect(r.rollup.totalHours).toBe(12);
  });
});
