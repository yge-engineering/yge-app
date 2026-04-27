import { describe, expect, it } from 'vitest';
import { buildDailyReportCompliance } from './daily-report-compliance';
import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';

function dispatch(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    scheduledFor: '2026-04-15',
    foremanName: 'Bob',
    scopeOfWork: 'Set forms.',
    crew: [],
    equipment: [],
    status: 'POSTED',
    ...over,
  } as Dispatch;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '',
    updatedAt: '',
    date: '2026-04-15',
    jobId: 'job-1',
    foremanId: 'emp-bob',
    weather: 'sunny',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildDailyReportCompliance', () => {
  it('counts only POSTED + COMPLETED dispatches in period', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        dispatch({ id: 'a', status: 'POSTED' }),
        dispatch({ id: 'b', status: 'COMPLETED' }),
        dispatch({ id: 'c', status: 'CANCELLED' }), // skip
        dispatch({ id: 'd', status: 'DRAFT' }),     // skip
        dispatch({ id: 'e', status: 'POSTED', scheduledFor: '2026-04-01' }), // out of period
      ],
      dailyReports: [],
    });
    expect(r.totalDispatchedDays).toBe(2);
  });

  it('matches reports to dispatches by (jobId, date)', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        dispatch({ id: 'd1', jobId: 'job-A', scheduledFor: '2026-04-15' }),
        dispatch({ id: 'd2', jobId: 'job-B', scheduledFor: '2026-04-15' }),
      ],
      dailyReports: [
        dr({ id: 'r1', jobId: 'job-A', date: '2026-04-15', submitted: true }),
        dr({ id: 'r2', jobId: 'job-B', date: '2026-04-15', submitted: false }), // not submitted
      ],
    });
    expect(r.totalDispatchedDays).toBe(2);
    expect(r.blendedComplianceRate).toBe(0.5);
  });

  it('rolls up by foreman and ranks worst-first', () => {
    // NOTE: matching is by (jobId, date), not by foreman. So this
    // fixture gives each foreman their own job to keep the math clean.
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        // Bob on job-A: 3 dispatches, 2 reports → 67%
        dispatch({ id: 'a', foremanName: 'Bob', jobId: 'job-A', scheduledFor: '2026-04-13' }),
        dispatch({ id: 'b', foremanName: 'Bob', jobId: 'job-A', scheduledFor: '2026-04-14' }),
        dispatch({ id: 'c', foremanName: 'Bob', jobId: 'job-A', scheduledFor: '2026-04-15' }),
        // Carol on job-C: 2 dispatches, 0 reports → 0%
        dispatch({ id: 'd', foremanName: 'Carol', jobId: 'job-C', scheduledFor: '2026-04-13' }),
        dispatch({ id: 'e', foremanName: 'Carol', jobId: 'job-C', scheduledFor: '2026-04-14' }),
      ],
      dailyReports: [
        dr({ id: 'r1', jobId: 'job-A', date: '2026-04-13' }),
        dr({ id: 'r2', jobId: 'job-A', date: '2026-04-14' }),
      ],
    });
    expect(r.byForeman[0]?.foremanName).toBe('Carol'); // worst first (0%)
    expect(r.byForeman[0]?.complianceRate).toBe(0);
    expect(r.byForeman[1]?.foremanName).toBe('Bob');
    expect(r.byForeman[1]?.complianceRate).toBeCloseTo(2 / 3, 4);
  });

  it('blendedComplianceRate uses dispatch-matched reports only', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        dispatch({ id: 'a', jobId: 'job-1', scheduledFor: '2026-04-13' }),
      ],
      dailyReports: [
        // Two reports, but only one matches a dispatch.
        dr({ id: 'r1', jobId: 'job-1', date: '2026-04-13' }),
        dr({ id: 'r2', jobId: 'job-orphan', date: '2026-04-15' }),
      ],
    });
    expect(r.totalReports).toBe(2);
    expect(r.totalDispatchedDays).toBe(1);
    expect(r.blendedComplianceRate).toBe(1); // 1 matched / 1 dispatched
  });

  it('byJob rolls up across foremen', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        dispatch({ id: 'a', jobId: 'job-X', scheduledFor: '2026-04-13' }),
        dispatch({ id: 'b', jobId: 'job-X', scheduledFor: '2026-04-14' }),
        dispatch({ id: 'c', jobId: 'job-X', scheduledFor: '2026-04-15' }),
      ],
      dailyReports: [
        dr({ jobId: 'job-X', date: '2026-04-13' }),
        dr({ jobId: 'job-X', date: '2026-04-15' }),
      ],
    });
    const x = r.byJob.find((j) => j.jobId === 'job-X')!;
    expect(x.dispatchedDays).toBe(3);
    expect(x.reportsSubmitted).toBe(2);
    expect(x.complianceRate).toBeCloseTo(2 / 3, 4);
  });

  it('uses jobNamesById for friendly display', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [dispatch({ jobId: 'job-foo', scheduledFor: '2026-04-15' })],
      dailyReports: [],
      jobNamesById: new Map([['job-foo', 'Sulphur Springs']]),
    });
    expect(r.byJob[0]?.projectName).toBe('Sulphur Springs');
  });

  it('records missingJobIds per foreman', () => {
    const r = buildDailyReportCompliance({
      start: '2026-04-13',
      end: '2026-04-17',
      dispatches: [
        dispatch({ id: 'a', foremanName: 'Bob', jobId: 'job-A', scheduledFor: '2026-04-13' }),
        dispatch({ id: 'b', foremanName: 'Bob', jobId: 'job-B', scheduledFor: '2026-04-14' }),
      ],
      dailyReports: [
        dr({ jobId: 'job-A', date: '2026-04-13' }), // covered
      ],
    });
    expect(r.byForeman[0]?.missingJobIds).toEqual(['job-B']);
  });
});
