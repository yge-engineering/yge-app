import { describe, expect, it } from 'vitest';

import type { DailyReport } from './daily-report';
import type { Job } from './job';

import { buildJobDrScopeCompleteness } from './job-dr-scope-completeness';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

function dr(over: Partial<DailyReport>): DailyReport {
  return {
    id: 'dr-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    date: '2026-04-15',
    jobId: 'j1',
    foremanId: 'fm1',
    crewOnSite: [],
    photoCount: 0,
    submitted: true,
    ...over,
  } as DailyReport;
}

describe('buildJobDrScopeCompleteness', () => {
  it('flags STRONG when both scope + plan are populated on most DRs', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: Array.from({ length: 10 }).map((_, i) =>
        dr({
          id: `dr-${i}`,
          date: `2026-04-${String(10 + i).padStart(2, '0')}`,
          scopeCompleted: 'Scope work logged',
          nextDayPlan: 'Continue tomorrow',
        }),
      ),
    });
    expect(r.rows[0]?.flag).toBe('STRONG');
    expect(r.rows[0]?.completenessRate).toBe(1);
  });

  it('flags POOR when neither field is populated', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', scopeCompleted: '', nextDayPlan: '' }),
        dr({ id: 'b', date: '2026-04-16', scopeCompleted: '', nextDayPlan: '' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('POOR');
    expect(r.rows[0]?.completenessRate).toBe(0);
  });

  it('counts withScope + withPlan + withIssues + withVisitors separately', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', scopeCompleted: 'x' }),
        dr({ id: 'b', date: '2026-04-16', nextDayPlan: 'y' }),
        dr({ id: 'c', date: '2026-04-17', issues: 'broken' }),
        dr({ id: 'd', date: '2026-04-18', visitors: 'inspector' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.withScope).toBe(1);
    expect(row?.withPlan).toBe(1);
    expect(row?.withIssues).toBe(1);
    expect(row?.withVisitors).toBe(1);
    expect(row?.completenessRate).toBe(0);
  });

  it('treats whitespace-only fields as empty', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', scopeCompleted: '   ', nextDayPlan: '\n\t' }),
      ],
    });
    expect(r.rows[0]?.withScope).toBe(0);
    expect(r.rows[0]?.withPlan).toBe(0);
  });

  it('skips draft DRs', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: [
        dr({ id: 'a', submitted: false, scopeCompleted: 'x', nextDayPlan: 'y' }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(0);
  });

  it('respects from/to date window', () => {
    const r = buildJobDrScopeCompleteness({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({})],
      reports: [
        dr({ id: 'old', date: '2026-03-15', scopeCompleted: 'x', nextDayPlan: 'y' }),
        dr({ id: 'in', date: '2026-04-15', scopeCompleted: 'x', nextDayPlan: 'y' }),
        dr({ id: 'after', date: '2026-05-15', scopeCompleted: 'x', nextDayPlan: 'y' }),
      ],
    });
    expect(r.rows[0]?.drCount).toBe(1);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('a');
  });

  it('includeAllStatuses=true includes non-AWARDED jobs', () => {
    const r = buildJobDrScopeCompleteness({
      includeAllStatuses: true,
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a', status: 'AWARDED' }),
      ],
      reports: [],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('sorts worst-first (POOR before STRONG)', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [
        job({ id: 'good', projectName: 'Good' }),
        job({ id: 'bad', projectName: 'Bad' }),
      ],
      reports: [
        dr({ id: 'good1', jobId: 'good', scopeCompleted: 'x', nextDayPlan: 'y' }),
        dr({ id: 'good2', jobId: 'good', date: '2026-04-16', scopeCompleted: 'x', nextDayPlan: 'y' }),
        dr({ id: 'bad1', jobId: 'bad' }),
        dr({ id: 'bad2', jobId: 'bad', date: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('bad');
    expect(r.rows[1]?.jobId).toBe('good');
  });

  it('flags POOR for AWARDED job with zero DRs', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [job({})],
      reports: [],
    });
    expect(r.rows[0]?.flag).toBe('POOR');
    expect(r.rows[0]?.drCount).toBe(0);
  });

  it('rolls up flag tier counts', () => {
    const r = buildJobDrScopeCompleteness({
      jobs: [
        job({ id: 's' }),
        job({ id: 't' }),
        job({ id: 'p' }),
      ],
      reports: [
        // 's' STRONG (100%)
        dr({ id: 's1', jobId: 's', scopeCompleted: 'x', nextDayPlan: 'y' }),
        // 't' THIN (50%)
        dr({ id: 't1', jobId: 't', scopeCompleted: 'x', nextDayPlan: 'y' }),
        dr({ id: 't2', jobId: 't', date: '2026-04-16' }),
        // 'p' POOR (no DRs)
      ],
    });
    expect(r.rollup.strong).toBe(1);
    expect(r.rollup.thin).toBe(1);
    expect(r.rollup.poor).toBe(1);
  });
});
