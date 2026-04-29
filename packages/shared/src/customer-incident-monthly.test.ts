import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';
import type { Job } from './job';

import { buildCustomerIncidentMonthly } from './customer-incident-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: 'C-1',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeId: 'e1',
    employeeName: 'Pat',
    location: 'Sulphur Springs',
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

describe('buildCustomerIncidentMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      incidents: [
        inc({ id: 'a', jobId: 'j1', incidentDate: '2026-04-15' }),
        inc({ id: 'b', jobId: 'j2', incidentDate: '2026-04-15' }),
        inc({ id: 'c', jobId: 'j1', incidentDate: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('breaks down by classification', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [job({ id: 'j1' })],
      incidents: [
        inc({ id: 'a', classification: 'INJURY' }),
        inc({ id: 'b', classification: 'SKIN_DISORDER' }),
        inc({ id: 'c', classification: 'INJURY' }),
      ],
    });
    expect(r.rows[0]?.byClassification.INJURY).toBe(2);
    expect(r.rows[0]?.byClassification.SKIN_DISORDER).toBe(1);
  });

  it('sums daysAway + daysRestricted', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [job({ id: 'j1' })],
      incidents: [
        inc({ id: 'a', daysAway: 3, daysRestricted: 1 }),
        inc({ id: 'b', daysAway: 5, daysRestricted: 2 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(8);
    expect(r.rows[0]?.totalDaysRestricted).toBe(3);
  });

  it('counts distinct jobs + employees', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      incidents: [
        inc({ id: 'a', jobId: 'j1', employeeId: 'e1' }),
        inc({ id: 'b', jobId: 'j2', employeeId: 'e2' }),
        inc({ id: 'c', jobId: 'j1', employeeId: 'e1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctEmployees).toBe(2);
  });

  it('counts unattributed (no jobId or no matching job)', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      incidents: [
        inc({ id: 'a', jobId: 'j1' }),
        inc({ id: 'b', jobId: undefined }),
        inc({ id: 'c', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerIncidentMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      incidents: [
        inc({ id: 'old', incidentDate: '2026-03-15' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerIncidentMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      incidents: [
        inc({ id: 'a', jobId: 'jZ', incidentDate: '2026-04-15' }),
        inc({ id: 'b', jobId: 'jA', incidentDate: '2026-05-01' }),
        inc({ id: 'c', jobId: 'jA', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerIncidentMonthly({ jobs: [], incidents: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalIncidents).toBe(0);
  });
});
