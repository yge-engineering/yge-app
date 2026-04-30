import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildJobIncidentSnapshot } from './job-incident-snapshot';

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
    description: 'Test',
    classification: 'INJURY',
    outcome: 'DAYS_AWAY',
    daysAway: 5,
    daysRestricted: 0,
    privacyCase: false,
    jobId: 'j1',
    ...over,
  } as Incident;
}

describe('buildJobIncidentSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobIncidentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalIncidents).toBe(1);
  });

  it('counts total + ytd', () => {
    const r = buildJobIncidentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      logYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15' }),
        inc({ id: 'b', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.totalIncidents).toBe(2);
    expect(r.ytdIncidents).toBe(1);
  });

  it('breaks down by classification + outcome', () => {
    const r = buildJobIncidentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', classification: 'INJURY', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', classification: 'SKIN_DISORDER', outcome: 'OTHER_RECORDABLE' }),
      ],
    });
    expect(r.byClassification.INJURY).toBe(1);
    expect(r.byClassification.SKIN_DISORDER).toBe(1);
    expect(r.byOutcome.DAYS_AWAY).toBe(1);
    expect(r.byOutcome.OTHER_RECORDABLE).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildJobIncidentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.totalDaysAway).toBe(8);
    expect(r.totalDaysRestricted).toBe(3);
  });

  it('counts distinct employees + last date', () => {
    const r = buildJobIncidentSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', employeeId: 'e1', incidentDate: '2026-04-08' }),
        inc({ id: 'b', employeeId: 'e2', incidentDate: '2026-04-22' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.lastIncidentDate).toBe('2026-04-22');
  });

  it('handles no matching incidents', () => {
    const r = buildJobIncidentSnapshot({ jobId: 'j1', incidents: [] });
    expect(r.totalIncidents).toBe(0);
    expect(r.lastIncidentDate).toBeNull();
  });
});
