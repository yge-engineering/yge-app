import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';
import type { Job } from './job';

import { buildCustomerIncidentDetailSnapshot } from './customer-incident-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

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

describe('buildCustomerIncidentDetailSnapshot', () => {
  it('returns one row per job sorted by count', () => {
    const r = buildCustomerIncidentDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      incidents: [
        inc({ id: 'a', jobId: 'j1', daysAway: 3 }),
        inc({ id: 'b', jobId: 'j1', daysAway: 5, employeeId: 'e2' }),
        inc({ id: 'c', jobId: 'j2', daysAway: 2 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.incidents).toBe(2);
    expect(r.rows[0]?.totalDaysLost).toBe(8);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerIncidentDetailSnapshot({
      customerName: 'X',
      jobs: [],
      incidents: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
