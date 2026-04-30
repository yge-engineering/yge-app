import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildPortfolioIncidentSnapshot } from './portfolio-incident-snapshot';

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
    ...over,
  } as Incident;
}

describe('buildPortfolioIncidentSnapshot', () => {
  it('counts total + ytd + classification + outcome', () => {
    const r = buildPortfolioIncidentSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15' }),
        inc({ id: 'b', incidentDate: '2026-04-15', classification: 'INJURY' }),
        inc({ id: 'c', incidentDate: '2026-04-16', classification: 'SKIN_DISORDER' }),
      ],
    });
    expect(r.totalIncidents).toBe(3);
    expect(r.ytdIncidents).toBe(2);
    expect(r.byClassification.INJURY).toBe(2); // includes 2025 INJURY too
    expect(r.byClassification.SKIN_DISORDER).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildPortfolioIncidentSnapshot({
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.totalDaysAway).toBe(8);
    expect(r.totalDaysRestricted).toBe(3);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioIncidentSnapshot({
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
      ],
    });
    expect(r.distinctEmployees).toBe(2);
    expect(r.distinctJobs).toBe(2);
  });

  it('ignores incidents after asOf', () => {
    const r = buildPortfolioIncidentSnapshot({
      asOf: '2026-04-30',
      incidents: [inc({ id: 'late', incidentDate: '2026-05-15' })],
    });
    expect(r.totalIncidents).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioIncidentSnapshot({ incidents: [] });
    expect(r.totalIncidents).toBe(0);
  });
});
