import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildEmployeeIncidentSnapshot } from './employee-incident-snapshot';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: 'C-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeId: 'e1',
    employeeName: 'Pat',
    location: 'Site',
    description: 'T',
    classification: 'INJURY',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    jobId: 'j1',
    ...over,
  } as Incident;
}

describe('buildEmployeeIncidentSnapshot', () => {
  it('filters to one employee', () => {
    const r = buildEmployeeIncidentSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      incidents: [inc({ id: 'a', employeeId: 'e1' }), inc({ id: 'b', employeeId: 'e2' })],
    });
    expect(r.totalIncidents).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildEmployeeIncidentSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.totalDaysAway).toBe(8);
    expect(r.totalDaysRestricted).toBe(3);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeIncidentSnapshot({ employeeId: 'X', incidents: [] });
    expect(r.totalIncidents).toBe(0);
    expect(r.lastIncidentDate).toBeNull();
  });
});
