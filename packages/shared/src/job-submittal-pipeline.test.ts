import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildJobSubmittalPipeline } from './job-submittal-pipeline';

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

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'Concrete mix',
    kind: 'MIX_DESIGN',
    status: 'SUBMITTED',
    submittedAt: '2026-04-15',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildJobSubmittalPipeline', () => {
  it('counts submittals by status', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', status: 'DRAFT' }),
        sub({ id: 'b', status: 'SUBMITTED' }),
        sub({ id: 'c', status: 'APPROVED' }),
        sub({ id: 'd', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'e', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'f', status: 'REJECTED' }),
        sub({ id: 'g', status: 'WITHDRAWN' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.draft).toBe(1);
    expect(row?.submitted).toBe(1);
    expect(row?.approved).toBe(1);
    expect(row?.approvedAsNoted).toBe(1);
    expect(row?.reviseResubmit).toBe(1);
    expect(row?.rejected).toBe(1);
    expect(row?.withdrawn).toBe(1);
    expect(row?.total).toBe(7);
  });

  it('flags submittals past responseDueAt', () => {
    const r = buildJobSubmittalPipeline({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'past', responseDueAt: '2026-04-20' }),
        sub({ id: 'future', responseDueAt: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.pastDueCount).toBe(1);
  });

  it('captures oldest in-flight age in days', () => {
    const r = buildJobSubmittalPipeline({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'old', submittedAt: '2026-04-01' }),
        sub({ id: 'new', submittedAt: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.oldestInFlightDays).toBe(29);
  });

  it('null oldest in-flight when none in SUBMITTED', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
      ],
    });
    expect(r.rows[0]?.oldestInFlightDays).toBe(null);
  });

  it('counts blocking-ordering only when status is SUBMITTED or REVISE_RESUBMIT', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [job({})],
      submittals: [
        sub({ id: 'sub-block', status: 'SUBMITTED', blocksOrdering: true }),
        sub({ id: 'rev-block', status: 'REVISE_RESUBMIT', blocksOrdering: true }),
        sub({ id: 'app-block', status: 'APPROVED', blocksOrdering: true }), // already approved — not blocking anymore
        sub({ id: 'sub-noblock', status: 'SUBMITTED', blocksOrdering: false }),
      ],
    });
    expect(r.rows[0]?.blockingOrdering).toBe(2);
  });

  it('computes avg cycle days from submittedAt → returnedAt', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01', returnedAt: '2026-04-11', status: 'APPROVED' }), // 10
        sub({ id: 'b', submittedAt: '2026-04-05', returnedAt: '2026-04-19', status: 'APPROVED' }), // 14
      ],
    });
    expect(r.rows[0]?.avgCycleDays).toBe(12);
  });

  it('null avg cycle when no completed submittals', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [job({})],
      submittals: [sub({ id: 'a', status: 'SUBMITTED' })],
    });
    expect(r.rows[0]?.avgCycleDays).toBe(null);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      submittals: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('a');
  });

  it('sorts most-blocking-ordering jobs first', () => {
    const r = buildJobSubmittalPipeline({
      jobs: [
        job({ id: 'clean' }),
        job({ id: 'blocked' }),
      ],
      submittals: [
        sub({ id: 'a', jobId: 'clean', status: 'APPROVED' }),
        sub({ id: 'b', jobId: 'blocked', status: 'SUBMITTED', blocksOrdering: true }),
        sub({ id: 'c', jobId: 'blocked', status: 'SUBMITTED', blocksOrdering: true }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('blocked');
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobSubmittalPipeline({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', responseDueAt: '2026-04-20', blocksOrdering: true }),
        sub({ id: 'b', status: 'SUBMITTED' }),
        sub({ id: 'c', status: 'APPROVED' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(3);
    expect(r.rollup.totalInFlight).toBe(2);
    expect(r.rollup.totalPastDue).toBe(1);
    expect(r.rollup.totalBlockingOrdering).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildJobSubmittalPipeline({ jobs: [], submittals: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalSubmittals).toBe(0);
  });
});
