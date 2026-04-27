import { describe, expect, it } from 'vitest';

import type { DirClassification, Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

import { buildEmployeeLaborCost } from './employee-labor-cost';

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

const RATES: Map<DirClassification, number> = new Map([
  ['LABORER_GROUP_1', 50_00],          // $50/hr
  ['OPERATING_ENGINEER_GROUP_2', 75_00],
  ['NOT_APPLICABLE', 30_00],
]);

describe('buildEmployeeLaborCost', () => {
  it('skips DRAFT and REJECTED time cards', () => {
    const r = buildEmployeeLaborCost({
      employees: [emp({})],
      timeCards: [
        tc({ id: 'd', status: 'DRAFT', entries: [entry({})] }),
        tc({ id: 'r', status: 'REJECTED', entries: [entry({})] }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.totalHours).toBe(0);
  });

  it('sums worked minutes across entries', () => {
    const r = buildEmployeeLaborCost({
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            entry({ jobId: 'job-1', startTime: '07:00', endTime: '15:00' }),
            entry({ jobId: 'job-1', startTime: '07:00', endTime: '15:00' }),
          ],
        }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.totalHours).toBe(16);
  });

  it('breaks hours down by job', () => {
    const r = buildEmployeeLaborCost({
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            entry({ jobId: 'job-A', startTime: '07:00', endTime: '15:00' }),
            entry({ jobId: 'job-B', startTime: '07:00', endTime: '11:00' }),
          ],
        }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.hoursByJob).toHaveLength(2);
    expect(r.rows[0]?.hoursByJob[0]?.jobId).toBe('job-A');
    expect(r.rows[0]?.hoursByJob[0]?.hours).toBe(8);
    expect(r.rows[0]?.hoursByJob[1]?.hours).toBe(4);
  });

  it('costs hours at per-classification rate', () => {
    const r = buildEmployeeLaborCost({
      employees: [emp({ classification: 'OPERATING_ENGINEER_GROUP_2' })],
      timeCards: [
        tc({
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.hourlyRateCents).toBe(75_00);
    expect(r.rows[0]?.totalCostCents).toBe(8 * 75_00);
  });

  it('zero rate when classification not in map', () => {
    const r = buildEmployeeLaborCost({
      employees: [emp({ classification: 'CARPENTER' })], // not in RATES
      timeCards: [
        tc({ entries: [entry({ startTime: '07:00', endTime: '15:00' })] }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.hourlyRateCents).toBe(0);
    expect(r.rows[0]?.totalCostCents).toBe(0);
  });

  it('respects window bounds', () => {
    const r = buildEmployeeLaborCost({
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
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.totalHours).toBe(8);
  });

  it('skips non-ACTIVE employees by default', () => {
    const r = buildEmployeeLaborCost({
      employees: [
        emp({ id: 'e-active', firstName: 'A', lastName: 'X' }),
        emp({ id: 'e-term', firstName: 'B', lastName: 'Y', status: 'TERMINATED' }),
      ],
      timeCards: [],
      ratesByClassification: RATES,
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.employeeId).toBe('e-active');
  });

  it('rolls up grand totals', () => {
    const r = buildEmployeeLaborCost({
      employees: [
        emp({ id: 'e1', firstName: 'A', lastName: 'X' }),
        emp({ id: 'e2', firstName: 'B', lastName: 'Y' }),
      ],
      timeCards: [
        tc({
          id: 'tc-1',
          employeeId: 'e1',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
        tc({
          id: 'tc-2',
          employeeId: 'e2',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rollup.totalHours).toBe(16);
    expect(r.rollup.totalCostCents).toBe(16 * 50_00);
  });

  it('sorts by total cost desc', () => {
    const r = buildEmployeeLaborCost({
      employees: [
        emp({ id: 'small', firstName: 'S', lastName: 'X' }),
        emp({
          id: 'big',
          firstName: 'B',
          lastName: 'Y',
          classification: 'OPERATING_ENGINEER_GROUP_2',
        }),
      ],
      timeCards: [
        tc({
          id: 'tc-s',
          employeeId: 'small',
          entries: [entry({ startTime: '07:00', endTime: '11:00' })],
        }),
        tc({
          id: 'tc-b',
          employeeId: 'big',
          entries: [entry({ startTime: '07:00', endTime: '15:00' })],
        }),
      ],
      ratesByClassification: RATES,
    });
    expect(r.rows[0]?.employeeId).toBe('big');
  });
});
