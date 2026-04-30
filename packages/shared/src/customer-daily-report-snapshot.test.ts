import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildCustomerDailyReportSnapshot } from './customer-daily-report-snapshot';

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

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'e1',
    weather: undefined,
    crewOnSite: [
      { employeeId: 'e1', startTime: '07:00', endTime: '15:30', lunchOut: '12:00', lunchIn: '12:30' },
    ],
    photoCount: 3,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildCustomerDailyReportSnapshot', () => {
  it('joins reports to a customer via job.ownerAgency', () => {
    const r = buildCustomerDailyReportSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' }), jb({ id: 'j2', ownerAgency: 'Other' })],
      dailyReports: [dr({ id: 'a', jobId: 'j1' }), dr({ id: 'b', jobId: 'j2' })],
    });
    expect(r.totalReports).toBe(1);
  });

  it('separates submitted vs draft', () => {
    const r = buildCustomerDailyReportSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb({ id: 'j1' })],
      dailyReports: [
        dr({ id: 'a', submitted: true }),
        dr({ id: 'b', submitted: false }),
      ],
    });
    expect(r.submittedReports).toBe(1);
    expect(r.draftReports).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerDailyReportSnapshot({ customerName: 'X', jobs: [], dailyReports: [] });
    expect(r.totalReports).toBe(0);
  });
});
