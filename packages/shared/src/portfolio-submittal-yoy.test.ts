import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildPortfolioSubmittalYoy } from './portfolio-submittal-yoy';

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

describe('buildPortfolioSubmittalYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioSubmittalYoy({
      currentYear: 2026,
      submittals: [
        sub({ id: 'a', submittedAt: '2025-04-15' }),
        sub({ id: 'b', submittedAt: '2026-04-15' }),
        sub({ id: 'c', submittedAt: '2026-05-15' }),
      ],
    });
    expect(r.priorTotalSubmitted).toBe(1);
    expect(r.currentTotalSubmitted).toBe(2);
    expect(r.totalSubmittedDelta).toBe(1);
  });

  it('counts by status', () => {
    const r = buildPortfolioSubmittalYoy({
      currentYear: 2026,
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
      ],
    });
    expect(r.currentApprovedCount).toBe(2);
    expect(r.currentReviseResubmitCount).toBe(1);
    expect(r.currentRejectedCount).toBe(1);
  });

  it('counts blocksOrdering + distinct jobs + authors', () => {
    const r = buildPortfolioSubmittalYoy({
      currentYear: 2026,
      submittals: [
        sub({ id: 'a', jobId: 'j1', submittedByEmployeeId: 'e1', blocksOrdering: true }),
        sub({ id: 'b', jobId: 'j2', submittedByEmployeeId: 'e2' }),
        sub({ id: 'c', jobId: 'j1', submittedByEmployeeId: 'e1' }),
      ],
    });
    expect(r.currentBlockedOrderingCount).toBe(1);
    expect(r.currentDistinctJobs).toBe(2);
    expect(r.currentDistinctAuthors).toBe(2);
  });

  it('skips submittals with no submittedAt', () => {
    const r = buildPortfolioSubmittalYoy({
      currentYear: 2026,
      submittals: [sub({ id: 'a', submittedAt: undefined })],
    });
    expect(r.currentTotalSubmitted).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioSubmittalYoy({ currentYear: 2026, submittals: [] });
    expect(r.currentTotalSubmitted).toBe(0);
  });
});
