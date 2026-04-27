import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentFrequency } from './incident-frequency';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-01',
    employeeName: 'John Smith',
    location: 'Sulphur Springs jobsite',
    description: 'twisted ankle stepping off equipment',
    classification: 'INJURY',
    outcome: 'OTHER_RECORDABLE',
    daysAway: 0,
    daysRestricted: 0,
    privacyCase: false,
    died: false,
    treatedInER: false,
    hospitalizedOvernight: false,
    calOshaReported: false,
    status: 'OPEN',
    ...over,
  } as Incident;
}

describe('buildIncidentFrequency', () => {
  it('counts outcomes by category', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', outcome: 'DEATH', employeeName: 'A' }),
        inc({ id: 'i-2', outcome: 'DAYS_AWAY', employeeName: 'B', daysAway: 5 }),
        inc({ id: 'i-3', outcome: 'JOB_TRANSFER_OR_RESTRICTION', employeeName: 'C' }),
        inc({ id: 'i-4', outcome: 'OTHER_RECORDABLE', employeeName: 'D' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(4);
    expect(r.rollup.fatalCount).toBe(1);
    expect(r.rollup.daysAwayCount).toBe(1);
    expect(r.rollup.jobTransferCount).toBe(1);
    expect(r.rollup.otherRecordableCount).toBe(1);
    expect(r.rollup.totalDaysAway).toBe(5);
  });

  it('computes TRIR and DART rate when total hours supplied', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', outcome: 'OTHER_RECORDABLE', employeeName: 'A' }),
        inc({ id: 'i-2', outcome: 'DAYS_AWAY', employeeName: 'B', daysAway: 3 }),
      ],
      totalHoursWorked: 100_000,
    });
    // TRIR = 2 * 200_000 / 100_000 = 4
    expect(r.rollup.trir).toBe(4);
    // DART numerator = 1 (the one with daysAway>0)
    // DART = 1 * 200_000 / 100_000 = 2
    expect(r.rollup.dartRate).toBe(2);
  });

  it('returns null TRIR/DART when total hours not supplied', () => {
    const r = buildIncidentFrequency({
      incidents: [inc({})],
    });
    expect(r.rollup.trir).toBe(null);
    expect(r.rollup.dartRate).toBe(null);
  });

  it('rolls up per-employee counts and last-incident date', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', employeeId: 'emp-1', employeeName: 'Smith', incidentDate: '2026-01-15' }),
        inc({ id: 'i-2', employeeId: 'emp-1', employeeName: 'Smith', incidentDate: '2026-04-01', daysAway: 7 }),
      ],
    });
    expect(r.byEmployee).toHaveLength(1);
    expect(r.byEmployee[0]?.incidentCount).toBe(2);
    expect(r.byEmployee[0]?.daysAwayTotal).toBe(7);
    expect(r.byEmployee[0]?.lastIncidentDate).toBe('2026-04-01');
  });

  it('falls back to employeeName when employeeId missing', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', employeeId: undefined, employeeName: 'Jane Doe' }),
        inc({ id: 'i-2', employeeId: undefined, employeeName: 'Jane Doe' }),
      ],
    });
    expect(r.byEmployee).toHaveLength(1);
    expect(r.byEmployee[0]?.incidentCount).toBe(2);
  });

  it('rolls up per-job counts when jobId is set', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', jobId: 'job-1' }),
        inc({ id: 'i-2', jobId: 'job-1', daysAway: 3 }),
        inc({ id: 'i-3', jobId: 'job-2' }),
        inc({ id: 'i-4', jobId: undefined }),
      ],
    });
    expect(r.byJob).toHaveLength(2);
    expect(r.byJob[0]?.jobId).toBe('job-1');
    expect(r.byJob[0]?.incidentCount).toBe(2);
    expect(r.byJob[0]?.daysAwayTotal).toBe(3);
  });

  it('respects fromDate / toDate range filter', () => {
    const r = buildIncidentFrequency({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      incidents: [
        inc({ id: 'i-1', incidentDate: '2026-03-15' }),
        inc({ id: 'i-2', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('sorts byEmployee and byJob by incident count desc', () => {
    const r = buildIncidentFrequency({
      incidents: [
        inc({ id: 'i-1', employeeId: 'emp-a', employeeName: 'A', jobId: 'job-1' }),
        inc({ id: 'i-2', employeeId: 'emp-b', employeeName: 'B', jobId: 'job-2' }),
        inc({ id: 'i-3', employeeId: 'emp-b', employeeName: 'B', jobId: 'job-2' }),
        inc({ id: 'i-4', employeeId: 'emp-b', employeeName: 'B', jobId: 'job-2' }),
      ],
    });
    expect(r.byEmployee[0]?.employeeId).toBe('emp-b');
    expect(r.byJob[0]?.jobId).toBe('job-2');
  });
});
