import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Incident } from './incident';

import { buildDartRateMonthly } from './dart-rate-monthly';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Worker',
    location: 'Site',
    description: 'desc',
    classification: 'INJURY',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    calOshaReported: false,
    status: 'OPEN',
    ...over,
  } as Incident;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

const c = (id: string) => ({ employeeId: id, startTime: '07:00', endTime: '15:00' });

describe('buildDartRateMonthly', () => {
  it('counts DART cases (DAYS_AWAY + JOB_TRANSFER_OR_RESTRICTION)', () => {
    const r = buildDartRateMonthly({
      incidents: [
        inc({ id: 'a', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', outcome: 'JOB_TRANSFER_OR_RESTRICTION' }),
        inc({ id: 'c', outcome: 'OTHER_RECORDABLE' }), // recordable but not DART
        inc({ id: 'd', outcome: 'DEATH' }),            // recordable but not DART
      ],
      reports: [],
    });
    expect(r.rows[0]?.dartCases).toBe(2);
    expect(r.rows[0]?.recordableCases).toBe(4);
  });

  it('sums dart days from daysAway + daysRestricted', () => {
    const r = buildDartRateMonthly({
      incidents: [
        inc({ id: 'a', outcome: 'DAYS_AWAY', daysAway: 7, daysRestricted: 3 }),
        inc({ id: 'b', outcome: 'OTHER_RECORDABLE', daysAway: 99 }), // not counted
      ],
      reports: [],
    });
    expect(r.rows[0]?.totalDartDays).toBe(10);
  });

  it('computes DART rate using 200,000 normalization', () => {
    // 1 DART case across 100,000 hours → rate 2.0
    // We need 100,000 hours = 100,000 × 60 = 6,000,000 minutes.
    // With each crew row contributing 8 hours = 480 minutes, we need
    // 100,000 / 8 = 12,500 crew rows. Use a single DR with crew of
    // size 12,500.
    const crew = Array.from({ length: 12_500 }).map((_, i) => c(`e${i}`));
    const r = buildDartRateMonthly({
      incidents: [inc({ id: 'a', outcome: 'DAYS_AWAY' })],
      reports: [dr({ id: 'dr', crewOnSite: crew })],
    });
    expect(r.rows[0]?.dartRate).toBe(2);
  });

  it('null DART rate when no hours', () => {
    const r = buildDartRateMonthly({
      incidents: [inc({ id: 'a', outcome: 'DAYS_AWAY' })],
      reports: [],
    });
    expect(r.rows[0]?.dartRate).toBe(null);
  });

  it('benchmarkDelta = rate − benchmark', () => {
    const crew = Array.from({ length: 12_500 }).map((_, i) => c(`e${i}`));
    const r = buildDartRateMonthly({
      benchmarkRate: 1.5,
      incidents: [inc({ id: 'a', outcome: 'DAYS_AWAY' })],
      reports: [dr({ id: 'dr', crewOnSite: crew })],
    });
    expect(r.rows[0]?.benchmarkDelta).toBe(0.5);
  });

  it('skips draft DRs', () => {
    const crew = Array.from({ length: 100 }).map((_, i) => c(`e${i}`));
    const r = buildDartRateMonthly({
      incidents: [],
      reports: [
        dr({ id: 'd', submitted: false, crewOnSite: crew }),
        dr({ id: 's', submitted: true, crewOnSite: crew }),
      ],
    });
    expect(r.rows[0]?.totalHours).toBe(800); // 100 × 8 from submitted only
  });

  it('respects month bounds', () => {
    const r = buildDartRateMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'mar', incidentDate: '2026-03-15' }),
        inc({ id: 'apr', incidentDate: '2026-04-15' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('rolls up blended DART rate', () => {
    // Two DART cases across 200,000 hours total → blended 2.0
    const crew200k = Array.from({ length: 25_000 }).map((_, i) => c(`e${i}`));
    const r = buildDartRateMonthly({
      incidents: [
        inc({ id: 'a', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', outcome: 'JOB_TRANSFER_OR_RESTRICTION' }),
      ],
      reports: [dr({ id: 'dr', crewOnSite: crew200k })],
    });
    expect(r.rollup.blendedDartRate).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildDartRateMonthly({ incidents: [], reports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.blendedDartRate).toBe(null);
  });
});
