import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentMonthlyByJob } from './incident-monthly-by-job';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Joe',
    location: 'Site',
    description: 'Test',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    jobId: 'j1',
    status: 'OPEN',
    ...over,
  } as Incident;
}

describe('buildIncidentMonthlyByJob', () => {
  it('groups by (jobId, month)', () => {
    const r = buildIncidentMonthlyByJob({
      incidents: [
        inc({ id: 'a', jobId: 'j1', incidentDate: '2026-03-15' }),
        inc({ id: 'b', jobId: 'j1', incidentDate: '2026-04-15' }),
        inc({ id: 'c', jobId: 'j2', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums daysAway and daysRestricted', () => {
    const r = buildIncidentMonthlyByJob({
      incidents: [
        inc({ id: 'a', daysAway: 5, daysRestricted: 2 }),
        inc({ id: 'b', daysAway: 3, daysRestricted: 0 }),
      ],
    });
    expect(r.rows[0]?.daysAwaySum).toBe(8);
    expect(r.rows[0]?.daysRestrictedSum).toBe(2);
  });

  it('counts distinct employees', () => {
    const r = buildIncidentMonthlyByJob({
      incidents: [
        inc({ id: 'a', employeeId: 'e1' }),
        inc({ id: 'b', employeeId: 'e2' }),
        inc({ id: 'c', employeeId: 'e1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('counts unattributed', () => {
    const r = buildIncidentMonthlyByJob({
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(2);
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildIncidentMonthlyByJob({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      incidents: [
        inc({ id: 'mar', incidentDate: '2026-03-15' }),
        inc({ id: 'apr', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildIncidentMonthlyByJob({
      incidents: [
        inc({ id: 'a', jobId: 'Z', incidentDate: '2026-04-15' }),
        inc({ id: 'b', jobId: 'A', incidentDate: '2026-04-15' }),
        inc({ id: 'c', jobId: 'A', incidentDate: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildIncidentMonthlyByJob({ incidents: [] });
    expect(r.rows).toHaveLength(0);
  });
});
