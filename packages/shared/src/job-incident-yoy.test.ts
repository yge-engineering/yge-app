import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildJobIncidentYoy } from './job-incident-yoy';

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

describe('buildJobIncidentYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobIncidentYoy({
      jobId: 'j1',
      currentYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15', daysAway: 3 }),
        inc({ id: 'b', incidentDate: '2026-04-15', daysAway: 5 }),
        inc({ id: 'c', incidentDate: '2026-08-15', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorTotalDaysAway).toBe(3);
    expect(r.currentTotalDaysAway).toBe(5);
  });

  it('handles unknown job', () => {
    const r = buildJobIncidentYoy({ jobId: 'X', currentYear: 2026, incidents: [] });
    expect(r.priorTotal).toBe(0);
  });
});
