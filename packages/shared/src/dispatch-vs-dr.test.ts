import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Dispatch } from './dispatch';

import { buildDispatchVsDr } from './dispatch-vs-dr';

function disp(over: Partial<Dispatch>): Dispatch {
  return {
    id: 'disp-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    scheduledFor: '2026-04-01',
    foremanName: 'Lopez',
    scopeOfWork: 'Grade base, set forms',
    status: 'POSTED',
    crew: [],
    equipment: [],
    ...over,
  } as Dispatch;
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T18:00:00.000Z',
    updatedAt: '2026-04-01T18:00:00.000Z',
    date: '2026-04-01',
    jobId: 'job-1',
    foremanId: 'emp-foreman',
    weather: 'CLEAR',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildDispatchVsDr', () => {
  it('flags MATCH when POSTED dispatch + submitted DR for same (job, date)', () => {
    const r = buildDispatchVsDr({
      dispatches: [disp({})],
      dailyReports: [dr({})],
    });
    expect(r.rows[0]?.flag).toBe('MATCH');
    expect(r.rollup.match).toBe(1);
  });

  it('flags MISSING_DR when POSTED dispatch but no DR', () => {
    const r = buildDispatchVsDr({
      dispatches: [disp({})],
      dailyReports: [],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_DR');
    expect(r.rollup.missingDr).toBe(1);
  });

  it('flags MISSING_DISPATCH when DR but no dispatch', () => {
    const r = buildDispatchVsDr({
      dispatches: [],
      dailyReports: [dr({})],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_DISPATCH');
    expect(r.rollup.missingDispatch).toBe(1);
  });

  it('flags DISPATCH_DRAFT when dispatch is DRAFT/CANCELLED and no DR', () => {
    const r = buildDispatchVsDr({
      dispatches: [disp({ status: 'DRAFT' })],
      dailyReports: [],
    });
    expect(r.rows[0]?.flag).toBe('DISPATCH_DRAFT');
    expect(r.rollup.dispatchDraft).toBe(1);
  });

  it('treats COMPLETED dispatch the same as POSTED', () => {
    const r = buildDispatchVsDr({
      dispatches: [disp({ status: 'COMPLETED' })],
      dailyReports: [dr({})],
    });
    expect(r.rows[0]?.flag).toBe('MATCH');
  });

  it('skips draft DRs (only counts submitted)', () => {
    const r = buildDispatchVsDr({
      dispatches: [disp({})],
      dailyReports: [dr({ submitted: false })],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_DR');
  });

  it('respects fromDate / toDate range filter', () => {
    const r = buildDispatchVsDr({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      dispatches: [disp({ scheduledFor: '2026-04-10' })],
      dailyReports: [dr({ date: '2026-04-10' })],
    });
    expect(r.rows).toHaveLength(0);
  });

  it('prefers POSTED over DRAFT when duplicate (jobId, date) dispatches', () => {
    const r = buildDispatchVsDr({
      dispatches: [
        disp({ id: 'disp-draft', status: 'DRAFT' }),
        disp({ id: 'disp-posted', status: 'POSTED' }),
      ],
      dailyReports: [dr({})],
    });
    expect(r.rows[0]?.dispatchId).toBe('disp-posted');
    expect(r.rows[0]?.flag).toBe('MATCH');
  });

  it('sorts MISSING_DR first (most actionable)', () => {
    const r = buildDispatchVsDr({
      dispatches: [
        // MATCH
        disp({ id: 'd-match', jobId: 'job-1', scheduledFor: '2026-04-01', status: 'POSTED' }),
        // MISSING_DR
        disp({ id: 'd-missing', jobId: 'job-2', scheduledFor: '2026-04-02', status: 'POSTED' }),
        // DISPATCH_DRAFT
        disp({ id: 'd-draft', jobId: 'job-3', scheduledFor: '2026-04-03', status: 'DRAFT' }),
      ],
      dailyReports: [
        dr({ id: 'dr-match', jobId: 'job-1', date: '2026-04-01' }),
        // MISSING_DISPATCH
        dr({ id: 'dr-orphan', jobId: 'job-4', date: '2026-04-04' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('MISSING_DR');
    expect(r.rows[1]?.flag).toBe('MISSING_DISPATCH');
    expect(r.rows[2]?.flag).toBe('DISPATCH_DRAFT');
    expect(r.rows[3]?.flag).toBe('MATCH');
  });
});
