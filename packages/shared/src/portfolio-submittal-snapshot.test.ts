import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildPortfolioSubmittalSnapshot } from './portfolio-submittal-snapshot';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '',
    updatedAt: '',
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

describe('buildPortfolioSubmittalSnapshot', () => {
  it('counts by status', () => {
    const r = buildPortfolioSubmittalSnapshot({
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED' }),
        sub({ id: 'b', status: 'APPROVED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
      ],
    });
    expect(r.byStatus.SUBMITTED).toBe(1);
    expect(r.byStatus.APPROVED).toBe(1);
    expect(r.byStatus.REVISE_RESUBMIT).toBe(1);
    expect(r.byStatus.REJECTED).toBe(1);
  });

  it('counts open vs overdue', () => {
    const r = buildPortfolioSubmittalSnapshot({
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', status: 'SUBMITTED', responseDueAt: '2026-04-20' }),
        sub({ id: 'b', status: 'SUBMITTED', responseDueAt: '2026-05-15' }),
        sub({ id: 'c', status: 'APPROVED', responseDueAt: '2026-04-20', returnedAt: '2026-04-22' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
  });

  it('counts blocksOrdering + distinct jobs + authors', () => {
    const r = buildPortfolioSubmittalSnapshot({
      asOf: '2026-04-30',
      submittals: [
        sub({ id: 'a', jobId: 'j1', submittedByEmployeeId: 'e1', blocksOrdering: true }),
        sub({ id: 'b', jobId: 'j2', submittedByEmployeeId: 'e2' }),
      ],
    });
    expect(r.blocksOrderingCount).toBe(1);
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctAuthors).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioSubmittalSnapshot({ submittals: [] });
    expect(r.totalSubmittals).toBe(0);
  });
});
