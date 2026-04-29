import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalByJob } from './submittal-by-job';

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

describe('buildSubmittalByJob', () => {
  it('groups by jobId', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'a', jobId: 'j1' }),
        sub({ id: 'b', jobId: 'j1' }),
        sub({ id: 'c', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each status separately', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
        sub({ id: 'e', status: 'WITHDRAWN' }),
        sub({ id: 'f', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.reviseResubmitCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
    expect(r.rows[0]?.withdrawnCount).toBe(1);
    expect(r.rows[0]?.pendingCount).toBe(1);
  });

  it('counts distinct authors and spec sections', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'a', submittedByEmployeeId: 'ryan', specSection: '03 30 00' }),
        sub({ id: 'b', submittedByEmployeeId: 'brook', specSection: '03 30 00' }),
        sub({ id: 'c', submittedByEmployeeId: 'ryan', specSection: '32 11 23' }),
      ],
    });
    expect(r.rows[0]?.distinctAuthors).toBe(2);
    expect(r.rows[0]?.distinctSpecSections).toBe(2);
  });

  it('skips drafts', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'live', status: 'SUBMITTED' }),
        sub({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('computes avg turnaround days', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01', returnedAt: '2026-04-15' }),
        sub({ id: 'b', submittedAt: '2026-04-01', returnedAt: '2026-04-08' }),
      ],
    });
    expect(r.rows[0]?.avgTurnaroundDays).toBe(10.5);
  });

  it('tracks lastSubmittedAt', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01' }),
        sub({ id: 'b', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.lastSubmittedAt).toBe('2026-04-15');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildSubmittalByJob({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by total desc', () => {
    const r = buildSubmittalByJob({
      submittals: [
        sub({ id: 's', jobId: 'small' }),
        sub({ id: 'b1', jobId: 'big' }),
        sub({ id: 'b2', jobId: 'big' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildSubmittalByJob({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
