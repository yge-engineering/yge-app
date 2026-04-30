import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildJobSubmittalSnapshot } from './job-submittal-snapshot';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    title: 'T',
    specSection: '03 30 00',
    status: 'SUBMITTED',
    submittedAt: '2026-04-01T00:00:00Z',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildJobSubmittalSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobSubmittalSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', jobId: 'j1' }),
        sub({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalSubmittals).toBe(1);
  });

  it('counts open + overdue', () => {
    const r = buildJobSubmittalSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', responseDueAt: '2026-04-15' }),
        sub({ id: 'b', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'c', status: 'APPROVED' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
  });

  it('counts blocks-ordering items', () => {
    const r = buildJobSubmittalSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: false }),
      ],
    });
    expect(r.blocksOrderingCount).toBe(1);
  });

  it('tracks oldest open age in days', () => {
    const r = buildJobSubmittalSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', submittedAt: '2026-04-15T00:00:00Z' }),
        sub({ id: 'b', status: 'SUBMITTED', submittedAt: '2026-03-01T00:00:00Z' }),
      ],
    });
    expect(r.oldestOpenAgeDays ?? 0).toBeGreaterThan(50);
  });

  it('handles no matching submittals', () => {
    const r = buildJobSubmittalSnapshot({ jobId: 'j1', submittals: [] });
    expect(r.totalSubmittals).toBe(0);
  });
});
