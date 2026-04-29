import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentByClassification } from './incident-by-classification';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Joe',
    location: 'Job site',
    description: 'Twisted ankle',
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

describe('buildIncidentByClassification', () => {
  it('groups by classification', () => {
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'INJURY' }),
        inc({ id: 'c', classification: 'RESPIRATORY' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const inj = r.rows.find((x) => x.classification === 'INJURY');
    expect(inj?.total).toBe(2);
  });

  it('breaks down by outcome', () => {
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'a', outcome: 'DAYS_AWAY' }),
        inc({ id: 'b', outcome: 'DAYS_AWAY' }),
        inc({ id: 'c', outcome: 'OTHER_RECORDABLE' }),
      ],
    });
    expect(r.rows[0]?.byOutcome.DAYS_AWAY).toBe(2);
    expect(r.rows[0]?.byOutcome.OTHER_RECORDABLE).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'a', daysAway: 5, daysRestricted: 2 }),
        inc({ id: 'b', daysAway: 3, daysRestricted: 0 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(8);
    expect(r.rows[0]?.totalDaysRestricted).toBe(2);
  });

  it('counts distinct employees and jobs', () => {
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e2', jobId: 'j1' }),
        inc({ id: 'c', employeeId: 'e1', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('computes share', () => {
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'INJURY' }),
        inc({ id: 'c', classification: 'INJURY' }),
        inc({ id: 'd', classification: 'RESPIRATORY' }),
      ],
    });
    const inj = r.rows.find((x) => x.classification === 'INJURY');
    expect(inj?.share).toBeCloseTo(0.75, 3);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildIncidentByClassification({
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
    const r = buildIncidentByClassification({
      incidents: [
        inc({ id: 'small', classification: 'POISONING' }),
        inc({ id: 'big1', classification: 'INJURY' }),
        inc({ id: 'big2', classification: 'INJURY' }),
      ],
    });
    expect(r.rows[0]?.classification).toBe('INJURY');
  });

  it('handles empty input', () => {
    const r = buildIncidentByClassification({ incidents: [] });
    expect(r.rows).toHaveLength(0);
  });
});
