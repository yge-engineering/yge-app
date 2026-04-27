import { describe, expect, it } from 'vitest';
import {
  buildPayrollSummary,
  computePayrollSummaryRollup,
} from './payroll-summary';
import type { DirClassification, Employee } from './employee';
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
    jobId: 'job-1',
    startTime: '07:00',
    endTime: '15:30',
    lunchOut: '12:00',
    lunchIn: '12:30',
    ...over,
  } as TimeEntry;
}

function card(over: Partial<TimeCard>, entries: Partial<TimeEntry>[] = []): TimeCard {
  return {
    id: 'tc-aaaaaaaa',
    createdAt: '2026-04-15T00:00:00Z',
    updatedAt: '2026-04-15T00:00:00Z',
    employeeId: 'emp-aaaaaaaa',
    weekStarting: '2026-04-13',
    entries: entries.map((e) => entry(e)),
    status: 'APPROVED',
    ...over,
  } as TimeCard;
}

const SIMPLE_RATES = new Map<DirClassification, { baseCentsPerHour: number; fringeCentsPerHour: number }>([
  ['OPERATING_ENGINEER_GROUP_1', { baseCentsPerHour: 60_00, fringeCentsPerHour: 30_00 }],
  ['LABORER_GROUP_1', { baseCentsPerHour: 40_00, fringeCentsPerHour: 20_00 }],
]);

describe('buildPayrollSummary', () => {
  it('multiplies regular hours by base rate', () => {
    // 8 hours/day Mon-Fri = 40 regular hours, 0 OT
    const dates = ['2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17'];
    const r = buildPayrollSummary({
      year: 2026,
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card(
          { employeeId: 'emp-1' },
          dates.map((d) => entry({ date: d, startTime: '07:00', endTime: '15:30' })),
        ),
      ],
      ratesByClassification: SIMPLE_RATES,
    });
    expect(r[0]?.regularHours).toBe(40);
    expect(r[0]?.overtimeHours).toBe(0);
    expect(r[0]?.regularWagesCents).toBe(40 * 60_00);
    expect(r[0]?.fringeCents).toBe(40 * 30_00);
  });

  it('counts daily OT >8h at 1.5× base', () => {
    // Mon = 12 hr (4 OT), Tue-Fri = 8 hr each (32 reg) = 36 reg + 4 OT = 40 total
    const r = buildPayrollSummary({
      year: 2026,
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card({ employeeId: 'emp-1' }, [
          entry({ date: '2026-04-13', startTime: '06:00', endTime: '18:00', lunchOut: undefined, lunchIn: undefined }),
          entry({ date: '2026-04-14', startTime: '07:00', endTime: '15:00', lunchOut: undefined, lunchIn: undefined }),
          entry({ date: '2026-04-15', startTime: '07:00', endTime: '15:00', lunchOut: undefined, lunchIn: undefined }),
          entry({ date: '2026-04-16', startTime: '07:00', endTime: '15:00', lunchOut: undefined, lunchIn: undefined }),
          entry({ date: '2026-04-17', startTime: '07:00', endTime: '15:00', lunchOut: undefined, lunchIn: undefined }),
        ]),
      ],
      ratesByClassification: SIMPLE_RATES,
    });
    expect(r[0]?.overtimeHours).toBe(4);
    expect(r[0]?.regularHours).toBe(36);
    expect(r[0]?.overtimeWagesCents).toBe(Math.round(4 * 60_00 * 1.5));
  });

  it('skips cards outside the requested year', () => {
    const r = buildPayrollSummary({
      year: 2026,
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card({ id: 'tc-2025', employeeId: 'emp-1', weekStarting: '2025-12-29' }, [
          entry({ date: '2025-12-29' }),
        ]),
        card({ id: 'tc-2026', employeeId: 'emp-1', weekStarting: '2026-01-05' }, [
          entry({ date: '2026-01-05' }),
        ]),
      ],
      ratesByClassification: SIMPLE_RATES,
    });
    expect(r[0]?.weeksWorked).toBe(1);
  });

  it('zero rate when classification has no DIR rate set', () => {
    const r = buildPayrollSummary({
      year: 2026,
      employees: [emp({ id: 'emp-1', classification: 'CARPENTER' })],
      timeCards: [
        card({ employeeId: 'emp-1' }, [entry({ date: '2026-04-15' })]),
      ],
      ratesByClassification: SIMPLE_RATES,
    });
    expect(r[0]?.baseRateCentsPerHour).toBe(0);
    expect(r[0]?.regularWagesCents).toBe(0);
  });

  it('employer tax estimate = gross × rate', () => {
    const r = buildPayrollSummary({
      year: 2026,
      employees: [emp({ id: 'emp-1' })],
      timeCards: [
        card(
          { employeeId: 'emp-1' },
          [
            entry({ date: '2026-04-13' }),
            entry({ date: '2026-04-14' }),
            entry({ date: '2026-04-15' }),
            entry({ date: '2026-04-16' }),
            entry({ date: '2026-04-17' }),
          ],
        ),
      ],
      ratesByClassification: SIMPLE_RATES,
      employerTaxRate: 0.25,
    });
    // 40 hr × $60 = $2,400 gross; 25% = $600
    expect(r[0]?.grossWagesCents).toBe(40 * 60_00);
    expect(r[0]?.employerTaxEstimateCents).toBe(Math.round(40 * 60_00 * 0.25));
  });
});

describe('computePayrollSummaryRollup', () => {
  it('sums hours, wages, fringe across all rows', () => {
    const r = buildPayrollSummary({
      year: 2026,
      employees: [
        emp({ id: 'emp-1' }),
        emp({ id: 'emp-2', classification: 'LABORER_GROUP_1' }),
      ],
      timeCards: [
        card({ id: 'tc-1', employeeId: 'emp-1' }, [
          entry({ date: '2026-04-13' }),
          entry({ date: '2026-04-14' }),
          entry({ date: '2026-04-15' }),
          entry({ date: '2026-04-16' }),
          entry({ date: '2026-04-17' }),
        ]),
        card({ id: 'tc-2', employeeId: 'emp-2', weekStarting: '2026-04-13' }, [
          entry({ date: '2026-04-13' }),
          entry({ date: '2026-04-14' }),
          entry({ date: '2026-04-15' }),
          entry({ date: '2026-04-16' }),
          entry({ date: '2026-04-17' }),
        ]),
      ],
      ratesByClassification: SIMPLE_RATES,
    });
    const rr = computePayrollSummaryRollup(r);
    expect(rr.totalHours).toBe(80);
    // emp-1: 40 × $60 = $2,400; emp-2: 40 × $40 = $1,600; total $4,000
    expect(rr.totalGrossWagesCents).toBe(40 * 60_00 + 40 * 40_00);
  });
});
