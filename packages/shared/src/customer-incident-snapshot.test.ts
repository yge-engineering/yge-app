import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';
import type { Job } from './job';

import { buildCustomerIncidentSnapshot } from './customer-incident-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
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

describe('buildCustomerIncidentSnapshot', () => {
  it('joins incidents to a customer via job.ownerAgency', () => {
    const r = buildCustomerIncidentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      incidents: [inc({ id: 'a', jobId: 'j1' }), inc({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalIncidents).toBe(1);
    expect(r.distinctJobs).toBe(1);
  });

  it('counts ytd + classification mix', () => {
    const r = buildCustomerIncidentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      logYear: 2026,
      jobs: [jb({ id: 'j1' })],
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15', classification: 'INJURY' }),
        inc({ id: 'b', incidentDate: '2026-04-15', classification: 'SKIN_DISORDER' }),
      ],
    });
    expect(r.totalIncidents).toBe(2);
    expect(r.ytdIncidents).toBe(1);
    expect(r.byClassification.SKIN_DISORDER).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildCustomerIncidentSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.totalDaysAway).toBe(8);
    expect(r.totalDaysRestricted).toBe(3);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerIncidentSnapshot({ customerName: 'X', jobs: [], incidents: [] });
    expect(r.totalIncidents).toBe(0);
    expect(r.lastIncidentDate).toBeNull();
  });
});
