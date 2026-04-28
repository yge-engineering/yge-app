import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Submittal } from './submittal';

import { buildJobBlockedOrdering } from './job-blocked-ordering';

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
    blocksOrdering: true,
    ...over,
  } as Submittal;
}

describe('buildJobBlockedOrdering', () => {
  it('lists submittals where blocksOrdering=true and status is SUBMITTED or REVISE_RESUBMIT', () => {
    const r = buildJobBlockedOrdering({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', blocksOrdering: true }),
        sub({ id: 'b', status: 'REVISE_RESUBMIT', blocksOrdering: true }),
        sub({ id: 'c', status: 'APPROVED', blocksOrdering: true }), // no longer blocking
        sub({ id: 'd', status: 'SUBMITTED', blocksOrdering: false }), // not blocking
      ],
    });
    expect(r.rows[0]?.blockedCount).toBe(2);
  });

  it('captures age in days for each blocked item', () => {
    const r = buildJobBlockedOrdering({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.items[0]?.ageDays).toBe(15);
  });

  it('sorts items within job by age desc', () => {
    const r = buildJobBlockedOrdering({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'new', submittedAt: '2026-04-25' }),
        sub({ id: 'old', submittedAt: '2026-04-01' }),
        sub({ id: 'mid', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.items[0]?.submittalId).toBe('old');
    expect(r.rows[0]?.items[2]?.submittalId).toBe('new');
  });

  it('captures oldestBlockedDays at job level', () => {
    const r = buildJobBlockedOrdering({
      asOf: '2026-04-30',
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01' }),
        sub({ id: 'b', submittedAt: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.oldestBlockedDays).toBe(29);
  });

  it('null oldestBlockedDays when no blocked items', () => {
    const r = buildJobBlockedOrdering({
      jobs: [job({})],
      submittals: [
        sub({ id: 'ok', status: 'APPROVED', blocksOrdering: true }),
      ],
    });
    expect(r.rows[0]?.oldestBlockedDays).toBe(null);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobBlockedOrdering({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      submittals: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('surfaces leadTimeNote on items', () => {
    const r = buildJobBlockedOrdering({
      jobs: [job({})],
      submittals: [
        sub({ id: 'a', leadTimeNote: '6 weeks for custom rebar' }),
      ],
    });
    expect(r.rows[0]?.items[0]?.leadTimeNote).toBe('6 weeks for custom rebar');
  });

  it('sorts jobs by blockedCount desc', () => {
    const r = buildJobBlockedOrdering({
      jobs: [
        job({ id: 'few' }),
        job({ id: 'many' }),
      ],
      submittals: [
        sub({ id: 'f1', jobId: 'few' }),
        sub({ id: 'm1', jobId: 'many' }),
        sub({ id: 'm2', jobId: 'many' }),
        sub({ id: 'm3', jobId: 'many' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('many');
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobBlockedOrdering({
      jobs: [
        job({ id: 'a' }),
        job({ id: 'b' }),
      ],
      submittals: [
        sub({ id: '1', jobId: 'a' }),
        sub({ id: '2', jobId: 'b' }),
        sub({ id: '3', jobId: 'b' }),
      ],
    });
    expect(r.rollup.jobsWithBlocked).toBe(2);
    expect(r.rollup.totalBlocked).toBe(3);
  });

  it('handles empty input', () => {
    const r = buildJobBlockedOrdering({ jobs: [], submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
