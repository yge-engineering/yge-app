import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentByOutcomeMonthly } from './incident-by-outcome-monthly';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: 'CASE-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Pat',
    location: 'Sulphur Springs',
    description: 'Test',
    classification: 'RECORDABLE',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    ...over,
  } as Incident;
}

describe('buildIncidentByOutcomeMonthly', () => {
  it('groups by (month, outcome)', () => {
    const r = buildIncidentByOutcomeMonthly({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-04-15', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', incidentDate: '2026-04-15', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'c', incidentDate: '2026-05-01', outcome: 'DAYS_AWAY' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums daysAway + daysRestricted per (month, outcome)', () => {
    const r = buildIncidentByOutcomeMonthly({
      incidents: [
        inc({ id: 'a', daysAway: 5, daysRestricted: 0 }),
        inc({ id: 'b', daysAway: 10, daysRestricted: 3 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(15);
    expect(r.rows[0]?.totalDaysRestricted).toBe(3);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildIncidentByOutcomeMonthly({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e1', jobId: 'j2' }),
        inc({ id: 'c', employeeId: 'e2', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildIncidentByOutcomeMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('rolls up portfolio totals', () => {
    const r = buildIncidentByOutcomeMonthly({
      incidents: [
        inc({ id: 'a', daysAway: 5 }),
        inc({ id: 'b', daysAway: 10, outcome: 'OTHER_RECORDABLE' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(2);
    expect(r.rollup.totalDaysAway).toBe(15);
  });

  it('sorts by month asc, outcome asc', () => {
    const r = buildIncidentByOutcomeMonthly({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-05-01', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', incidentDate: '2026-04-15', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'c', incidentDate: '2026-04-15', outcome: 'DAYS_AWAY' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[0]?.outcome).toBe('DAYS_AWAY');
    expect(r.rows[2]?.month).toBe('2026-05');
  });

  it('handles empty input', () => {
    const r = buildIncidentByOutcomeMonthly({ incidents: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalIncidents).toBe(0);
  });
});
