import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildEmployeeIncidentDetailSnapshot } from './employee-incident-detail-snapshot';

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

describe('buildEmployeeIncidentDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildEmployeeIncidentDetailSnapshot({
      employeeId: 'e1',
      asOf: '2026-04-30',
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1', classification: 'INJURY', outcome: 'DAYS_AWAY', daysAway: 3 }),
        inc({ id: 'b', employeeId: 'e1', jobId: 'j1', classification: 'INJURY', outcome: 'OTHER_RECORDABLE' }),
        inc({ id: 'c', employeeId: 'e1', jobId: 'j2', classification: 'RESPIRATORY', outcome: 'JOB_TRANSFER_OR_RESTRICTION', daysRestricted: 5 }),
        inc({ id: 'd', employeeId: 'e2', jobId: 'j1', classification: 'INJURY' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.injury).toBe(2);
    expect(r.rows[0]?.daysAway).toBe(3);
    expect(r.rows[0]?.recordable).toBe(1);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.illness).toBe(1);
    expect(r.rows[1]?.daysRestricted).toBe(5);
  });

  it('handles unknown employee', () => {
    const r = buildEmployeeIncidentDetailSnapshot({ employeeId: 'X', incidents: [] });
    expect(r.rows.length).toBe(0);
  });
});
