import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentByEmployee } from './incident-by-employee';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: 'C-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeId: 'e1',
    employeeName: 'Pat',
    location: 'Sulphur Springs',
    description: 'Test',
    classification: 'INJURY',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    ...over,
  } as Incident;
}

describe('buildIncidentByEmployee', () => {
  it('groups by employeeId', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', employeeId: 'e1' }),
        inc({ id: 'b', employeeId: 'e1' }),
        inc({ id: 'c', employeeId: 'e2', employeeName: 'Sam' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('falls back to name when employeeId missing', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', employeeId: undefined, employeeName: 'Pat' }),
      ],
    });
    expect(r.rows[0]?.employeeKey).toBe('name:pat');
  });

  it('breaks down by classification', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'SKIN_DISORDER' }),
        inc({ id: 'c', classification: 'INJURY' }),
      ],
    });
    expect(r.rows[0]?.byClassification.INJURY).toBe(2);
    expect(r.rows[0]?.byClassification.SKIN_DISORDER).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(8);
    expect(r.rows[0]?.totalDaysRestricted).toBe(3);
  });

  it('tracks last incident date', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-04-10' }),
        inc({ id: 'b', incidentDate: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.lastIncidentDate).toBe('2026-04-25');
  });

  it('counts distinct jobs', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromDate / toDate', () => {
    const r = buildIncidentByEmployee({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildIncidentByEmployee({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', employeeName: 'A' }),
        inc({ id: 'b', employeeId: 'e2', employeeName: 'B' }),
        inc({ id: 'c', employeeId: 'e2', employeeName: 'B' }),
      ],
    });
    expect(r.rows[0]?.employeeKey).toBe('e2');
  });

  it('handles empty input', () => {
    const r = buildIncidentByEmployee({ incidents: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalIncidents).toBe(0);
  });
});
