import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalByAuthor } from './submittal-by-author';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '03 30 00-1',
    subject: 'CIP concrete mix',
    kind: 'PRODUCT_DATA',
    submittedByEmployeeId: 'ryan',
    status: 'SUBMITTED',
    submittedAt: '2026-04-01',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildSubmittalByAuthor', () => {
  it('groups submittals by submittedByEmployeeId', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', submittedByEmployeeId: 'ryan' }),
        sub({ id: 'b', submittedByEmployeeId: 'brook' }),
        sub({ id: 'c', submittedByEmployeeId: 'ryan' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts approved (APPROVED + APPROVED_AS_NOTED)', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
  });

  it('counts revise/rejected separately', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'b', status: 'REJECTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
      ],
    });
    expect(r.rows[0]?.reviseResubmitCount).toBe(2);
    expect(r.rows[0]?.rejectedCount).toBe(1);
  });

  it('counts blocksOrdering submittals', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: false }),
        sub({ id: 'c', blocksOrdering: true }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(2);
  });

  it('skips drafts', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', status: 'DRAFT' }),
        sub({ id: 'b', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(1);
  });

  it('computes avg turnaround days', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01', returnedAt: '2026-04-15' }),
        sub({ id: 'b', submittedAt: '2026-04-01', returnedAt: '2026-04-08' }),
      ],
    });
    expect(r.rows[0]?.avgTurnaroundDays).toBe(10.5);
  });

  it('counts unattributed submittals on rollup but not in rows', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 'a', submittedByEmployeeId: 'ryan' }),
        sub({ id: 'b', submittedByEmployeeId: undefined }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(2);
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window', () => {
    const r = buildSubmittalByAuthor({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(1);
  });

  it('sorts by totalSubmitted desc', () => {
    const r = buildSubmittalByAuthor({
      submittals: [
        sub({ id: 's', submittedByEmployeeId: 'small' }),
        sub({ id: 'b1', submittedByEmployeeId: 'big' }),
        sub({ id: 'b2', submittedByEmployeeId: 'big' }),
      ],
    });
    expect(r.rows[0]?.submittedByEmployeeId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildSubmittalByAuthor({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
