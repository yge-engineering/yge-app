import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalByAuthorMonthly } from './submittal-by-author-monthly';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '001',
    subject: 'Concrete mix design',
    kind: 'PRODUCT_DATA',
    status: 'APPROVED',
    submittedByEmployeeId: 'e1',
    submittedAt: '2026-04-15',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildSubmittalByAuthorMonthly', () => {
  it('groups by (author, month)', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', submittedByEmployeeId: 'e1', submittedAt: '2026-04-15' }),
        sub({ id: 'b', submittedByEmployeeId: 'e1', submittedAt: '2026-05-01' }),
        sub({ id: 'c', submittedByEmployeeId: 'e2', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts by status', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
        sub({ id: 'e', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.totalSubmitted).toBe(5);
    expect(r.rows[0]?.approvedCount).toBe(2); // APPROVED + APPROVED_AS_NOTED
    expect(r.rows[0]?.reviseResubmitCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
  });

  it('counts blocksOrdering', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: false }),
        sub({ id: 'c', blocksOrdering: true }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(2);
  });

  it('counts distinct jobs per (author, month)', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', jobId: 'j1' }),
        sub({ id: 'b', jobId: 'j2' }),
        sub({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('skips submittals with no submittedAt or no author', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', submittedAt: undefined }),
        sub({ id: 'b', submittedByEmployeeId: undefined }),
        sub({ id: 'c' }),
      ],
    });
    expect(r.rollup.noSubmittedAtSkipped).toBe(1);
    expect(r.rollup.noAuthorSkipped).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildSubmittalByAuthorMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by author asc, month asc', () => {
    const r = buildSubmittalByAuthorMonthly({
      submittals: [
        sub({ id: 'a', submittedByEmployeeId: 'eZ', submittedAt: '2026-04-15' }),
        sub({ id: 'b', submittedByEmployeeId: 'eA', submittedAt: '2026-05-01' }),
        sub({ id: 'c', submittedByEmployeeId: 'eA', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.submittedByEmployeeId).toBe('eA');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.submittedByEmployeeId).toBe('eZ');
  });

  it('handles empty input', () => {
    const r = buildSubmittalByAuthorMonthly({ submittals: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalSubmittals).toBe(0);
  });
});
