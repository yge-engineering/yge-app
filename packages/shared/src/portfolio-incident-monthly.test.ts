import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildPortfolioIncidentMonthly } from './portfolio-incident-monthly';

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

describe('buildPortfolioIncidentMonthly', () => {
  it('breaks down by classification + outcome', () => {
    const r = buildPortfolioIncidentMonthly({
      incidents: [
        inc({ id: 'a', classification: 'INJURY', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', classification: 'SKIN_DISORDER', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'c', classification: 'INJURY', outcome: 'DAYS_AWAY' }),
      ],
    });
    expect(r.rows[0]?.byClassification.INJURY).toBe(2);
    expect(r.rows[0]?.byClassification.SKIN_DISORDER).toBe(1);
    expect(r.rows[0]?.byOutcome.DAYS_AWAY).toBe(2);
    expect(r.rows[0]?.byOutcome.OTHER_RECORDABLE).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildPortfolioIncidentMonthly({
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.rows[0]?.daysAway).toBe(8);
    expect(r.rows[0]?.daysRestricted).toBe(3);
  });

  it('counts distinct employees + jobs', () => {
    const r = buildPortfolioIncidentMonthly({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioIncidentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioIncidentMonthly({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-06-15' }),
        inc({ id: 'b', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioIncidentMonthly({ incidents: [] });
    expect(r.rows).toHaveLength(0);
  });
});
