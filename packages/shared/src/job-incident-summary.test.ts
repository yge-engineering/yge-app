import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildJobIncidentSummary } from './job-incident-summary';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Joe Operator',
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

describe('buildJobIncidentSummary', () => {
  it('groups incidents by jobId', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: 'j1' }),
        inc({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const j1 = r.rows.find((x) => x.jobId === 'j1');
    expect(j1?.total).toBe(2);
  });

  it('breaks down by outcome and classification', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', outcome: 'DAYS_AWAY', classification: 'INJURY' }),
        inc({ id: 'b', outcome: 'JOB_TRANSFER_OR_RESTRICTION', classification: 'RESPIRATORY' }),
        inc({ id: 'c', outcome: 'DAYS_AWAY', classification: 'INJURY' }),
      ],
    });
    expect(r.rows[0]?.byOutcome.DAYS_AWAY).toBe(2);
    expect(r.rows[0]?.byClassification.INJURY).toBe(2);
    expect(r.rows[0]?.byClassification.RESPIRATORY).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 0 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(8);
    expect(r.rows[0]?.totalDaysRestricted).toBe(2);
  });

  it('counts distinct employees by id when present, name fallback otherwise', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', employeeName: 'Joe' }),
        inc({ id: 'b', employeeId: 'e1', employeeName: 'Joe' }),
        inc({ id: 'c', employeeId: undefined, employeeName: 'Mary' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('counts open incidents', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', status: 'OPEN' }),
        inc({ id: 'b', status: 'CLOSED' }),
        inc({ id: 'c', status: 'OPEN' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(2);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildJobIncidentSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('counts unattributed incidents (no jobId) on rollup, excludes from rows', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: undefined }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(2);
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by total desc, ties by totalDaysAway desc', () => {
    const r = buildJobIncidentSummary({
      incidents: [
        inc({ id: 'a1', jobId: 'A', daysAway: 0 }),
        inc({ id: 'a2', jobId: 'A', daysAway: 0 }),
        inc({ id: 'b1', jobId: 'B', daysAway: 10 }),
        inc({ id: 'b2', jobId: 'B', daysAway: 0 }),
      ],
    });
    // A and B both have 2 incidents; tie broken by daysAway (B=10, A=0).
    expect(r.rows[0]?.jobId).toBe('B');
  });

  it('handles empty input', () => {
    const r = buildJobIncidentSummary({ incidents: [] });
    expect(r.rows).toHaveLength(0);
  });
});
