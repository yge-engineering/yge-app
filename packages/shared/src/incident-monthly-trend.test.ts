import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentMonthlyTrend } from './incident-monthly-trend';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Worker A',
    location: 'Sulphur Springs',
    description: 'Slip and fall',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
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

describe('buildIncidentMonthlyTrend', () => {
  it('buckets incidents by yyyy-mm', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-03-15' }),
        inc({ id: 'b', incidentDate: '2026-03-28' }),
        inc({ id: 'c', incidentDate: '2026-04-02' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[0]?.totalIncidents).toBe(2);
    expect(r.rows[1]?.month).toBe('2026-04');
    expect(r.rows[1]?.totalIncidents).toBe(1);
  });

  it('counts outcomes', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', outcome: 'DEATH' }),
        inc({ id: 'b', outcome: 'DAYS_AWAY' }),
        inc({ id: 'c', outcome: 'JOB_TRANSFER_OR_RESTRICTION' }),
        inc({ id: 'd', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'e', outcome: 'OTHER_RECORDABLE' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.deathCount).toBe(1);
    expect(row?.daysAwayCount).toBe(1);
    expect(row?.restrictionCount).toBe(1);
    expect(row?.otherRecordableCount).toBe(2);
  });

  it('splits classification into injury vs illness', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'RESPIRATORY' }),
        inc({ id: 'c', classification: 'SKIN_DISORDER' }),
      ],
    });
    expect(r.rows[0]?.injuryCount).toBe(1);
    expect(r.rows[0]?.illnessCount).toBe(2);
  });

  it('sums DART days from daysAway + daysRestricted', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', daysAway: 5, daysRestricted: 2 }),
        inc({ id: 'b', daysAway: 0, daysRestricted: 3 }),
      ],
    });
    expect(r.rows[0]?.dartDays).toBe(10);
    expect(r.rows[0]?.daysAwayTotal).toBe(5);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e1', jobId: 'j2' }),
        inc({ id: 'c', employeeId: 'e2', jobId: 'j1' }),
        inc({ id: 'd', employeeId: 'e2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects from/to month bounds', () => {
    const r = buildIncidentMonthlyTrend({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'jan', incidentDate: '2026-01-15' }),
        inc({ id: 'mar', incidentDate: '2026-03-15' }),
        inc({ id: 'apr', incidentDate: '2026-04-15' }),
        inc({ id: 'may', incidentDate: '2026-05-15' }),
      ],
    });
    expect(r.rows.map((x) => x.month)).toEqual(['2026-03', '2026-04']);
  });

  it('captures peak month + count', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-02-01' }),
        inc({ id: 'b', incidentDate: '2026-03-01' }),
        inc({ id: 'c', incidentDate: '2026-03-15' }),
        inc({ id: 'd', incidentDate: '2026-03-28' }),
        inc({ id: 'e', incidentDate: '2026-04-01' }),
      ],
    });
    expect(r.rollup.peakMonth).toBe('2026-03');
    expect(r.rollup.peakIncidents).toBe(3);
  });

  it('computes month-over-month change', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-03-15' }),
        inc({ id: 'b', incidentDate: '2026-03-20' }),
        inc({ id: 'c', incidentDate: '2026-04-15' }),
        inc({ id: 'd', incidentDate: '2026-04-16' }),
        inc({ id: 'e', incidentDate: '2026-04-17' }),
        inc({ id: 'f', incidentDate: '2026-04-18' }),
      ],
    });
    // Latest 2026-04 has 4, prior 2026-03 had 2 → +2.
    expect(r.rollup.monthOverMonthChange).toBe(2);
  });

  it('rollup totals + sorts rows ascending', () => {
    const r = buildIncidentMonthlyTrend({
      incidents: [
        inc({
          id: 'a',
          incidentDate: '2026-04-15',
          outcome: 'DEATH',
          daysAway: 0,
          daysRestricted: 0,
        }),
        inc({
          id: 'b',
          incidentDate: '2026-02-15',
          daysAway: 5,
          daysRestricted: 1,
        }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
    expect(r.rows[1]?.month).toBe('2026-04');
    expect(r.rollup.totalIncidents).toBe(2);
    expect(r.rollup.totalDartDays).toBe(6);
    expect(r.rollup.totalDeaths).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildIncidentMonthlyTrend({ incidents: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakMonth).toBe(null);
    expect(r.rollup.monthOverMonthChange).toBe(0);
  });
});
