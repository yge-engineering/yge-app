import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildJobIncidentDetailSnapshot } from './job-incident-detail-snapshot';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '',
    updatedAt: '',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeId: 'e1',
    employeeName: 'Pat',
    location: 'Sta. 12+50',
    description: 'X',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    status: 'OPEN',
    jobId: 'j1',
    ...over,
  } as Incident;
}

describe('buildJobIncidentDetailSnapshot', () => {
  it('returns one row per employee sorted by total', () => {
    const r = buildJobIncidentDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', jobId: 'j1', employeeName: 'Pat', classification: 'INJURY', outcome: 'DAYS_AWAY', daysAway: 3 }),
        inc({ id: 'b', jobId: 'j1', employeeName: 'Pat', classification: 'INJURY', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'c', jobId: 'j1', employeeName: 'Sam', classification: 'RESPIRATORY', outcome: 'JOB_TRANSFER_OR_RESTRICTION', daysRestricted: 5 }),
        inc({ id: 'd', jobId: 'j2', employeeName: 'Pat' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.employeeName).toBe('Pat');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.injury).toBe(2);
    expect(r.rows[0]?.daysAway).toBe(3);
    expect(r.rows[1]?.employeeName).toBe('Sam');
    expect(r.rows[1]?.illness).toBe(1);
    expect(r.rows[1]?.daysRestricted).toBe(5);
  });

  it('handles unknown job', () => {
    const r = buildJobIncidentDetailSnapshot({ jobId: 'X', incidents: [] });
    expect(r.rows.length).toBe(0);
  });
});
