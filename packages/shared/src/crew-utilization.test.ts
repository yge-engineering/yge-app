import { describe, expect, it } from 'vitest';
import {
  buildCrewUtilization,
  workdaysBetween,
  workdayHoursBetween,
} from './crew-utilization';
import type { Employee } from './employee';
import type { TimeCard, TimeEntry } from './time-card';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-aaaaaaaa',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function entry(over: Partial<TimeEntry>): TimeEntry {
  return {
    date: '2026-04-15',
    jobId: 'job-real-1',
    startTime: '07:00',
    endTime: '15:00', // 8 hours, no lunch
    ...over,
  } as TimeEntry;
}

function card(employeeId: string, entries: Partial<TimeEntry>[]): TimeCard {
  return {
    id: `tc-${employeeId}`,
    createdAt: '',
    updatedAt: '',
    employeeId,
    weekStarting: '2026-04-13',
    entries: entries.map((e) => entry(e)),
    status: 'APPROVED',
  } as TimeCard;
}

describe('workdaysBetween', () => {
  it('counts Mon-Fri inclusive', () => {
    // 2026-04-13 = Monday, 2026-04-17 = Friday
    expect(workdaysBetween('2026-04-13', '2026-04-17')).toBe(5);
  });

  it('skips weekends', () => {
    // 2026-04-11 = Saturday, 2026-04-12 = Sunday
    expect(workdaysBetween('2026-04-11', '2026-04-12')).toBe(0);
  });

  it('full April 2026 = 22 workdays', () => {
    expect(workdaysBetween('2026-04-01', '2026-04-30')).toBe(22);
  });

  it('returns 0 for inverted range', () => {
    expect(workdaysBetween('2026-04-30', '2026-04-01')).toBe(0);
  });

  it('workdayHoursBetween multiplies by 8', () => {
    expect(workdayHoursBetween('2026-04-13', '2026-04-17')).toBe(40);
  });
});

describe('buildCrewUtilization', () => {
  it('separates billable from overhead by jobId set', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card('emp-1', [
          entry({ date: '2026-04-13', jobId: 'job-real-1' }), // 8 billable
          entry({ date: '2026-04-14', jobId: 'job-real-2' }), // 8 billable
          entry({ date: '2026-04-15', jobId: 'OVH-SHOP' }),   // 8 overhead
          entry({ date: '2026-04-16', jobId: 'OVH-TRAINING' }), // 8 overhead
          entry({ date: '2026-04-17', jobId: 'job-real-1' }), // 8 billable
        ]),
      ],
      overheadJobIds: ['OVH-SHOP', 'OVH-TRAINING'],
    });
    const row = r.rows[0]!;
    expect(row.actualHours).toBe(40);
    expect(row.billableHours).toBe(24);
    expect(row.overheadHours).toBe(16);
    expect(row.targetHours).toBe(40);
    expect(row.utilization).toBeCloseTo(24 / 40, 4);
    expect(row.flag).toBe('WELL_UTILIZED');
  });

  it('flags NO_TIMECARD when employee has no entries in period', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-ghost' })],
      timeCards: [],
    });
    const row = r.rows[0]!;
    expect(row.flag).toBe('NO_TIMECARD');
    expect(row.actualHours).toBe(0);
    expect(row.utilization).toBe(0);
  });

  it('flags UNDER_UTILIZED when billable < 50% of target', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card('emp-1', [
          // Only 16 billable hours out of 40 target = 40% utilization
          entry({ date: '2026-04-13', jobId: 'job-real-1' }), // 8 billable
          entry({ date: '2026-04-14', jobId: 'job-real-1' }), // 8 billable
          entry({ date: '2026-04-15', jobId: 'OVH-SHOP' }),   // 8 overhead
          entry({ date: '2026-04-16', jobId: 'OVH-SHOP' }),   // 8 overhead
          entry({ date: '2026-04-17', jobId: 'OVH-SHOP' }),   // 8 overhead
        ]),
      ],
      overheadJobIds: ['OVH-SHOP'],
    });
    expect(r.rows[0]?.flag).toBe('UNDER_UTILIZED');
  });

  it('flags OVER_TARGET when actual > 110% of target', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card('emp-1', [
          // 60 hr week: 12 hr × 5 days
          entry({
            date: '2026-04-13',
            startTime: '06:00',
            endTime: '18:00',
            jobId: 'job-real-1',
          }),
          entry({
            date: '2026-04-14',
            startTime: '06:00',
            endTime: '18:00',
            jobId: 'job-real-1',
          }),
          entry({
            date: '2026-04-15',
            startTime: '06:00',
            endTime: '18:00',
            jobId: 'job-real-1',
          }),
          entry({
            date: '2026-04-16',
            startTime: '06:00',
            endTime: '18:00',
            jobId: 'job-real-1',
          }),
          entry({
            date: '2026-04-17',
            startTime: '06:00',
            endTime: '18:00',
            jobId: 'job-real-1',
          }),
        ]),
      ],
    });
    expect(r.rows[0]?.actualHours).toBe(60);
    expect(r.rows[0]?.flag).toBe('OVER_TARGET');
  });

  it('skips entries outside the period', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card('emp-1', [
          entry({ date: '2026-04-06', jobId: 'job-real-1' }), // before
          entry({ date: '2026-04-15', jobId: 'job-real-1' }), // in
          entry({ date: '2026-04-20', jobId: 'job-real-1' }), // after
        ]),
      ],
    });
    expect(r.rows[0]?.actualHours).toBe(8);
  });

  it('applies labor rates and emits dollar splits', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1', classification: 'LABORER_GROUP_1' })],
      timeCards: [
        card('emp-1', [
          entry({ date: '2026-04-13', jobId: 'job-real-1' }), // 8 billable
          entry({ date: '2026-04-14', jobId: 'OVH-SHOP' }),    // 8 overhead
        ]),
      ],
      overheadJobIds: ['OVH-SHOP'],
      laborRatesByClassification: new Map([['LABORER_GROUP_1', 50_00]]),
    });
    const row = r.rows[0]!;
    expect(row.billableCostCents).toBe(8 * 50_00);
    expect(row.overheadCostCents).toBe(8 * 50_00);
    expect(r.rollup.totalOverheadCostCents).toBe(8 * 50_00);
  });

  it('rollup blends utilization across all employees', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [emp({ id: 'emp-1' }), emp({ id: 'emp-2' })],
      timeCards: [
        card('emp-1', [
          entry({ date: '2026-04-13', jobId: 'job-real-1' }),
          entry({ date: '2026-04-14', jobId: 'job-real-1' }),
          entry({ date: '2026-04-15', jobId: 'job-real-1' }),
          entry({ date: '2026-04-16', jobId: 'job-real-1' }),
          entry({ date: '2026-04-17', jobId: 'job-real-1' }),
        ]),
        // emp-2 has no card → all 40 target hours unfilled
      ],
    });
    expect(r.rollup.totalBillableHours).toBe(40);
    expect(r.rollup.totalTargetHours).toBe(80); // 2 employees × 40
    expect(r.rollup.blendedUtilization).toBeCloseTo(0.5, 4);
  });

  it('sorts worst-utilization first; NO_TIMECARD pinned to bottom', () => {
    const r = buildCrewUtilization({
      start: '2026-04-13',
      end: '2026-04-17',
      employees: [
        emp({ id: 'emp-good' }),
        emp({ id: 'emp-bad' }),
        emp({ id: 'emp-ghost' }),
      ],
      timeCards: [
        card('emp-good', [
          entry({ date: '2026-04-13', jobId: 'job-real-1' }),
          entry({ date: '2026-04-14', jobId: 'job-real-1' }),
          entry({ date: '2026-04-15', jobId: 'job-real-1' }),
          entry({ date: '2026-04-16', jobId: 'job-real-1' }),
          entry({ date: '2026-04-17', jobId: 'job-real-1' }),
        ]),
        card('emp-bad', [
          entry({ date: '2026-04-13', jobId: 'OVH-SHOP' }),
          entry({ date: '2026-04-14', jobId: 'OVH-SHOP' }),
          entry({ date: '2026-04-15', jobId: 'OVH-SHOP' }),
        ]),
      ],
      overheadJobIds: ['OVH-SHOP'],
    });
    expect(r.rows.map((x) => x.employeeId)).toEqual([
      'emp-bad',    // 0% billable
      'emp-good',   // 100% billable
      'emp-ghost',  // NO_TIMECARD pinned bottom
    ]);
  });
});
