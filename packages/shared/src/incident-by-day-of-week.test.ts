import { describe, expect, it } from 'vitest';

import type { Incident } from './incident';

import { buildIncidentByDayOfWeek } from './incident-by-day-of-week';

function inc(over: Partial<Incident>): Incident {
  return {
    id: 'inc-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    caseNumber: '2026-001',
    logYear: 2026,
    incidentDate: '2026-04-15',
    employeeName: 'Joe',
    location: 'Site',
    description: 'Test',
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

describe('buildIncidentByDayOfWeek', () => {
  it('groups by day of week', () => {
    const r = buildIncidentByDayOfWeek({
      incidents: [
        inc({ id: 'a', incidentDate: '2026-04-13' }), // Mon
        inc({ id: 'b', incidentDate: '2026-04-13' }),
        inc({ id: 'c', incidentDate: '2026-04-15' }), // Wed
      ],
    });
    expect(r.rows).toHaveLength(2);
    const mon = r.rows.find((x) => x.label === 'Monday');
    expect(mon?.count).toBe(2);
  });

  it('sums daysAway', () => {
    const r = buildIncidentByDayOfWeek({
      incidents: [
        inc({ id: 'a', daysAway: 5 }),
        inc({ id: 'b', daysAway: 3 }),
      ],
    });
    expect(r.rows[0]?.totalDaysAway).toBe(8);
  });

  it('counts distinct employees and jobs', () => {
    const r = buildIncidentByDayOfWeek({
      incidents: [
        inc({ id: 'a', employeeId: 'e1', jobId: 'j1' }),
        inc({ id: 'b', employeeId: 'e2', jobId: 'j2' }),
        inc({ id: 'c', employeeId: 'e1', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctEmployees).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sorts Mon-first', () => {
    const r = buildIncidentByDayOfWeek({
      incidents: [
        inc({ id: 'sun', incidentDate: '2026-04-19' }),
        inc({ id: 'mon', incidentDate: '2026-04-13' }),
      ],
    });
    expect(r.rows.map((x) => x.label)).toEqual(['Monday', 'Sunday']);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildIncidentByDayOfWeek({
      fromDate: '2026-04-14',
      toDate: '2026-04-30',
      incidents: [
        inc({ id: 'old', incidentDate: '2026-04-13' }),
        inc({ id: 'in', incidentDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalIncidents).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildIncidentByDayOfWeek({ incidents: [] });
    expect(r.rows).toHaveLength(0);
  });
});
