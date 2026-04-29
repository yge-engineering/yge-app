import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildPortfolioIncidentYoy } from './portfolio-incident-yoy';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: 'C-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
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

describe('buildPortfolioIncidentYoy', () => {
  it('compares prior vs current year', () => {
    const r = buildPortfolioIncidentYoy({
      currentYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15', daysAway: 5 }),
        inc({ id: 'b', incidentDate: '2026-04-15', daysAway: 10 }),
      ],
    });
    expect(r.priorTotalIncidents).toBe(1);
    expect(r.currentTotalIncidents).toBe(1);
    expect(r.priorDaysAway).toBe(5);
    expect(r.currentDaysAway).toBe(10);
    expect(r.daysAwayDelta).toBe(5);
  });

  it('breaks down by classification per year', () => {
    const r = buildPortfolioIncidentYoy({
      currentYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15', classification: 'INJURY' }),
        inc({ id: 'b', incidentDate: '2026-04-15', classification: 'INJURY' }),
        inc({ id: 'c', incidentDate: '2026-04-16', classification: 'SKIN_DISORDER' }),
      ],
    });
    expect(r.priorByClassification.INJURY).toBe(1);
    expect(r.currentByClassification.INJURY).toBe(1);
    expect(r.currentByClassification.SKIN_DISORDER).toBe(1);
  });

  it('ignores incidents outside the two-year window', () => {
    const r = buildPortfolioIncidentYoy({
      currentYear: 2026,
      incidents: [
        inc({ id: 'a', incidentDate: '2024-04-15' }),
        inc({ id: 'b', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.priorTotalIncidents).toBe(0);
    expect(r.currentTotalIncidents).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildPortfolioIncidentYoy({ currentYear: 2026, incidents: [] });
    expect(r.priorTotalIncidents).toBe(0);
    expect(r.currentTotalIncidents).toBe(0);
  });
});
