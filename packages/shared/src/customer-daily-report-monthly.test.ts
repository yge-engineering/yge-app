import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildCustomerDailyReportMonthly } from './customer-daily-report-monthly';

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
    ...over,
  } as DailyReport;
}

describe('buildCustomerDailyReportMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerDailyReportMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-15' }),
        dr({ id: 'b', jobId: 'j2', date: '2026-04-15' }),
        dr({ id: 'c', jobId: 'j1', date: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts DRs, distinct dates, foremen, jobs', () => {
    const r = buildCustomerDailyReportMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans D2' }),
      ],
      dailyReports: [
        dr({ id: 'a', date: '2026-04-15', foremanId: 'f1', jobId: 'j1' }),
        dr({ id: 'b', date: '2026-04-15', foremanId: 'f2', jobId: 'j2' }),
        dr({ id: 'c', date: '2026-04-16', foremanId: 'f1', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.drs).toBe(3);
    expect(r.rows[0]?.distinctDates).toBe(2);
    expect(r.rows[0]?.distinctForemen).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('sums crewDays + photoCount', () => {
    const r = buildCustomerDailyReportMonthly({
      jobs: [job({ id: 'j1' })],
      dailyReports: [
        dr({
          id: 'a',
          photoCount: 5,
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
            { employeeId: 'e2', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
        dr({
          id: 'b',
          photoCount: 3,
          crewOnSite: [
            { employeeId: 'e1', startTime: '07:00', endTime: '15:30' },
          ] as DailyReport['crewOnSite'],
        }),
      ],
    });
    expect(r.rows[0]?.crewDays).toBe(3);
    expect(r.rows[0]?.photoCount).toBe(8);
  });

  it('counts unattributed (no matching job)', () => {
    const r = buildCustomerDailyReportMonthly({
      jobs: [job({ id: 'j1' })],
      dailyReports: [
        dr({ id: 'a', jobId: 'j1' }),
        dr({ id: 'b', jobId: 'orphan' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerDailyReportMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      dailyReports: [
        dr({ id: 'old', date: '2026-03-15' }),
        dr({ id: 'in', date: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalDrs).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerDailyReportMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      dailyReports: [
        dr({ id: 'a', jobId: 'jZ', date: '2026-04-15' }),
        dr({ id: 'b', jobId: 'jA', date: '2026-05-01' }),
        dr({ id: 'c', jobId: 'jA', date: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerDailyReportMonthly({ jobs: [], dailyReports: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalDrs).toBe(0);
  });
});
