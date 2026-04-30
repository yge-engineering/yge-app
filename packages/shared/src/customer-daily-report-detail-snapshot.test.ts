import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildCustomerDailyReportDetailSnapshot } from './customer-daily-report-detail-snapshot';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'f1',
    crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '11:30', lunchIn: '12:00' }],
    ...over,
  } as DailyReport;
}

describe('buildCustomerDailyReportDetailSnapshot', () => {
  it('returns one row per job sorted by total', () => {
    const r = buildCustomerDailyReportDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      dailyReports: [
        dr({ id: 'a', jobId: 'j1', date: '2026-04-13', foremanId: 'f1', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }] }),
        dr({ id: 'b', jobId: 'j1', date: '2026-04-14', foremanId: 'f1', issues: 'Pump broke', crewOnSite: [{ employeeId: 'e1', startTime: '07:00', endTime: '15:30' }, { employeeId: 'e2', startTime: '07:00', endTime: '15:30' }] }),
        dr({ id: 'c', jobId: 'j2', date: '2026-04-15', foremanId: 'f2', visitors: 'Caltrans inspector', crewOnSite: [{ employeeId: 'e3', startTime: '07:00', endTime: '15:30' }] }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.withIssues).toBe(1);
    expect(r.rows[0]?.distinctForemen).toBe(1);
    expect(r.rows[0]?.distinctCrew).toBe(2);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.withVisitors).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerDailyReportDetailSnapshot({
      customerName: 'X',
      jobs: [],
      dailyReports: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
