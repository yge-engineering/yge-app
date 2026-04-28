import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Employee } from './employee';
import type { TimeCard } from './time-card';

import { buildEmployeeTimecardAccuracy } from './employee-timecard-accuracy';

function emp(over: Partial<Employee>): Employee {
  return {
    id: 'emp-1',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    firstName: 'Jane',
    lastName: 'Doe',
    role: 'LABORER',
    classification: 'LABORER_GROUP_1',
    status: 'ACTIVE',
    certifications: [],
    ...over,
  } as Employee;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-foreman',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

function tc(over: Partial<TimeCard>): TimeCard {
  return {
    id: 'tc-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    employeeId: 'emp-1',
    weekStarting: '2026-04-13',
    entries: [],
    status: 'SUBMITTED',
    ...over,
  } as TimeCard;
}

describe('buildEmployeeTimecardAccuracy', () => {
  it('flags NO_DATA when no TC and no DR rows', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [],
      dailyReports: [],
    });
    expect(r.rows[0]?.tier).toBe('NO_DATA');
  });

  it('counts MATCHED days', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-15', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      dailyReports: [
        dr({
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.matchedDays).toBe(1);
    expect(r.rows[0]?.accuracyScore).toBe(1);
    expect(r.rows[0]?.tier).toBe('CLEAN');
  });

  it('counts TC_HIGHER, DR_HIGHER, missing days separately', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-15', jobId: 'job-1', startTime: '07:00', endTime: '17:00' }, // 10h TC
            { date: '2026-04-16', jobId: 'job-1', startTime: '07:00', endTime: '11:00' }, // 4h TC, no DR row
          ],
        }),
      ],
      dailyReports: [
        dr({
          id: 'd1',
          date: '2026-04-15',
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h DR
          ],
        }),
        dr({
          id: 'd2',
          date: '2026-04-17',
          crewOnSite: [
            { employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }, // 8h DR, no TC
          ],
        }),
      ],
    });
    expect(r.rows[0]?.tcHigherDays).toBe(1);   // 04-15
    expect(r.rows[0]?.missingDrDays).toBe(1);   // 04-16
    expect(r.rows[0]?.missingTcDays).toBe(1);   // 04-17
    expect(r.rows[0]?.matchedDays).toBe(0);
  });

  it('skips DRAFT and REJECTED time cards', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [
        tc({ status: 'DRAFT', entries: [{ date: '2026-04-15', jobId: 'job-1', startTime: '07:00', endTime: '15:00' }] }),
      ],
      dailyReports: [],
    });
    expect(r.rows[0]?.consideredDays).toBe(0);
  });

  it('skips draft DRs', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [],
      dailyReports: [
        dr({
          submitted: false,
          crewOnSite: [{ employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }],
        }),
      ],
    });
    expect(r.rows[0]?.consideredDays).toBe(0);
  });

  it('respects window bounds', () => {
    const r = buildEmployeeTimecardAccuracy({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      employees: [emp({})],
      timeCards: [
        tc({
          entries: [
            { date: '2026-04-10', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
            { date: '2026-04-20', jobId: 'job-1', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
      dailyReports: [],
    });
    expect(r.rows[0]?.consideredDays).toBe(1);
  });

  it('skips non-ACTIVE employees', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [
        emp({ id: 'a', firstName: 'A', lastName: 'X' }),
        emp({ id: 'b', firstName: 'B', lastName: 'Y', status: 'TERMINATED' }),
      ],
      timeCards: [],
      dailyReports: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('classifies tiers', () => {
    // Build 10 days with 9 matched, 1 mismatch → 0.9 → OK
    const entries = [];
    const drRows = [];
    for (let d = 1; d <= 10; d += 1) {
      const day = `2026-04-${String(d).padStart(2, '0')}`;
      entries.push({ date: day, jobId: 'job-1', startTime: '07:00', endTime: '15:00' });
      if (d === 10) {
        drRows.push(dr({ id: `dr-${d}`, date: day, crewOnSite: [{ employeeId: 'emp-1', startTime: '06:00', endTime: '17:00' }] }));
      } else {
        drRows.push(dr({ id: `dr-${d}`, date: day, crewOnSite: [{ employeeId: 'emp-1', startTime: '07:00', endTime: '15:00' }] }));
      }
    }
    const r = buildEmployeeTimecardAccuracy({
      employees: [emp({})],
      timeCards: [tc({ entries })],
      dailyReports: drRows,
    });
    expect(r.rows[0]?.tier).toBe('OK');
  });

  it('rolls up tier counts and sorts NEEDS_COACHING first', () => {
    const r = buildEmployeeTimecardAccuracy({
      employees: [
        emp({ id: 'clean', firstName: 'C', lastName: 'X' }),
        emp({ id: 'bad', firstName: 'B', lastName: 'Y' }),
      ],
      timeCards: [
        tc({
          id: 't-c',
          employeeId: 'clean',
          entries: [{ date: '2026-04-15', jobId: 'job-1', startTime: '07:00', endTime: '15:00' }],
        }),
        tc({
          id: 't-b',
          employeeId: 'bad',
          entries: [{ date: '2026-04-15', jobId: 'job-1', startTime: '07:00', endTime: '20:00' }],
        }),
      ],
      dailyReports: [
        dr({
          id: 'd-c',
          date: '2026-04-15',
          crewOnSite: [
            { employeeId: 'clean', startTime: '07:00', endTime: '15:00' },
            { employeeId: 'bad', startTime: '07:00', endTime: '15:00' },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.employeeId).toBe('bad');
    expect(r.rows[0]?.tier).toBe('NEEDS_COACHING');
  });
});
