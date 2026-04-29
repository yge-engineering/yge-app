import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildPortfolioSubmittalMonthly } from './portfolio-submittal-monthly';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'Test',
    kind: 'PRODUCT_DATA',
    status: 'APPROVED',
    submittedAt: '2026-04-15',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildPortfolioSubmittalMonthly', () => {
  it('counts by status', () => {
    const r = buildPortfolioSubmittalMonthly({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.reviseResubmitCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
  });

  it('counts blocksOrdering + distinct jobs + authors', () => {
    const r = buildPortfolioSubmittalMonthly({
      submittals: [
        sub({ id: 'a', jobId: 'j1', submittedByEmployeeId: 'e1', blocksOrdering: true }),
        sub({ id: 'b', jobId: 'j2', submittedByEmployeeId: 'e2' }),
        sub({ id: 'c', jobId: 'j1', submittedByEmployeeId: 'e1' }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(1);
    expect(r.rows[0]?.distinctJobs).toBe(2);
    expect(r.rows[0]?.distinctAuthors).toBe(2);
  });

  it('skips submittals with no submittedAt', () => {
    const r = buildPortfolioSubmittalMonthly({
      submittals: [
        sub({ id: 'a', submittedAt: undefined }),
        sub({ id: 'b' }),
      ],
    });
    expect(r.rollup.noSubmittedAtSkipped).toBe(1);
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioSubmittalMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioSubmittalMonthly({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-06-15' }),
        sub({ id: 'b', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioSubmittalMonthly({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
