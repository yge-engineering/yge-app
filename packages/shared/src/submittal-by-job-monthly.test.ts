import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalByJobMonthly } from './submittal-by-job-monthly';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'Test',
    kind: 'PRODUCT_DATA',
    status: 'SUBMITTED',
    submittedAt: '2026-04-15',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildSubmittalByJobMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildSubmittalByJobMonthly({
      submittals: [
        sub({ id: 'a', jobId: 'j1', submittedAt: '2026-03-15' }),
        sub({ id: 'b', jobId: 'j1', submittedAt: '2026-04-15' }),
        sub({ id: 'c', jobId: 'j2', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts approved + revise + pending', () => {
    const r = buildSubmittalByJobMonthly({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'c', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.reviseCount).toBe(1);
    expect(r.rows[0]?.pendingCount).toBe(1);
  });

  it('skips drafts', () => {
    const r = buildSubmittalByJobMonthly({
      submittals: [
        sub({ id: 'live', status: 'SUBMITTED' }),
        sub({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildSubmittalByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      submittals: [
        sub({ id: 'mar', submittedAt: '2026-03-15' }),
        sub({ id: 'apr', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildSubmittalByJobMonthly({
      submittals: [
        sub({ id: 'a', jobId: 'Z', submittedAt: '2026-04-15' }),
        sub({ id: 'b', jobId: 'A', submittedAt: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildSubmittalByJobMonthly({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
