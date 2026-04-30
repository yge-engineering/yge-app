import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';
import type { Job } from './job';

import { buildCustomerIncidentYoy } from './customer-incident-yoy';

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

describe('buildCustomerIncidentYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerIncidentYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Other')],
      incidents: [
        inc({ id: 'a', incidentDate: '2025-04-15', daysAway: 3 }),
        inc({ id: 'b', incidentDate: '2026-04-15', daysAway: 5 }),
        inc({ id: 'c', incidentDate: '2026-04-15', jobId: 'j2' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorTotalDaysAway).toBe(3);
    expect(r.currentTotalDaysAway).toBe(5);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerIncidentYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      incidents: [],
    });
    expect(r.priorTotal).toBe(0);
    expect(r.currentTotal).toBe(0);
  });
});
