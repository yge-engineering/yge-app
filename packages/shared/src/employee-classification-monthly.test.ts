import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Employee } from './employee';

import { buildEmployeeClassificationMonthly } from './employee-classification-monthly';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'e1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    firstName: 'Test',
    lastName: 'Person',
    role: 'OPERATOR',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildEmployeeClassificationMonthly', () => {
  it('groups by (classification, month)', () => {
    const r = buildEmployeeClassificationMonthly({
      employees: [
        emp({ id: 'e1', classification: 'OPERATING_ENGINEER_GROUP_1' }),
        emp({ id: 'e2', classification: 'LABORER_GROUP_1' }),
      ],
      dailyReports: [dr({
        crewOnSite: [
          { employeeId: 'e1', startTime: '08:00', endTime: '16:00' },
          { employeeId: 'e2', startTime: '08:00', endTime: '16:00' },
        ],
      })],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts distinct employees per (classification, month)', () => {
    const r = buildEmployeeClassificationMonthly({
      employees: [
        emp({ id: 'e1', classification: 'LABORER_GROUP_1' }),
        emp({ id: 'e2', classification: 'LABORER_GROUP_1' }),
      ],
      dailyReports: [
        dr({ id: 'a', crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
        dr({ id: 'b', date: '2026-04-16', crewOnSite: [{ employeeId: 'e2', startTime: '08:00', endTime: '16:00' }] }),
        dr({ id: 'c', date: '2026-04-17', crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.totalCrewRows).toBe(3);
  });

  it('skips unsubmitted DRs', () => {
    const r = buildEmployeeClassificationMonthly({
      employees: [emp({ id: 'e1' })],
      dailyReports: [
        dr({ id: 'live', submitted: true, crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
        dr({ id: 'draft', submitted: false, crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
      ],
    });
    expect(r.rollup.totalCrewRows).toBe(1);
  });

  it('falls back to NOT_APPLICABLE when employee not in registry', () => {
    const r = buildEmployeeClassificationMonthly({
      employees: [],
      dailyReports: [dr({ crewOnSite: [{ employeeId: 'unknown', startTime: '08:00', endTime: '16:00' }] })],
    });
    expect(r.rows[0]?.classification).toBe('NOT_APPLICABLE');
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildEmployeeClassificationMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      employees: [emp({ id: 'e1' })],
      dailyReports: [
        dr({ id: 'mar', date: '2026-03-15', crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
        dr({ id: 'apr', date: '2026-04-15', crewOnSite: [{ employeeId: 'e1', startTime: '08:00', endTime: '16:00' }] }),
      ],
    });
    expect(r.rollup.totalCrewRows).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildEmployeeClassificationMonthly({ employees: [], dailyReports: [] });
    expect(r.rows).toHaveLength(0);
  });
});
