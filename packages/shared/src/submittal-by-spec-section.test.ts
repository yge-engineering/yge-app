import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalBySpecSection } from './submittal-by-spec-section';

function sub(over: Partial<Submittal>): Submittal {
  return {
    id: 'sub-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    submittalNumber: '03 30 00-1',
    subject: 'CIP concrete mix',
    kind: 'PRODUCT_DATA',
    specSection: '03 30 00 - Cast-in-Place Concrete',
    status: 'SUBMITTED',
    submittedAt: '2026-04-01',
    blocksOrdering: false,
    ...over,
  } as Submittal;
}

describe('buildSubmittalBySpecSection', () => {
  it('groups submittals by specSection (case-insensitive, normalized whitespace)', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', specSection: '03 30 00 - Cast-in-Place Concrete' }),
        sub({ id: 'b', specSection: '03  30  00 - cast-in-place concrete' }),
        sub({ id: 'c', specSection: '03 30 00 - CAST-IN-PLACE CONCRETE' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.submitted).toBe(3);
  });

  it('counts approved combo + revise + rejected separately', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'REVISE_RESUBMIT' }),
        sub({ id: 'd', status: 'REJECTED' }),
        sub({ id: 'e', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.reviseResubmitCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
    expect(r.rows[0]?.pendingCount).toBe(1);
  });

  it('counts blocksOrdering submittals', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: true }),
        sub({ id: 'c', blocksOrdering: false }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(2);
  });

  it('counts distinct jobs touched per spec section', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', jobId: 'j1' }),
        sub({ id: 'b', jobId: 'j2' }),
        sub({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('skips drafts', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'live', status: 'SUBMITTED' }),
        sub({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(1);
  });

  it('computes avg turnaround days', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01', returnedAt: '2026-04-15' }),
        sub({ id: 'b', submittedAt: '2026-04-01', returnedAt: '2026-04-08' }),
      ],
    });
    expect(r.rows[0]?.avgTurnaroundDays).toBe(10.5);
  });

  it('counts unattributed (no specSection) on rollup, excludes from rows', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'a', specSection: '03 30 00' }),
        sub({ id: 'b', specSection: undefined }),
        sub({ id: 'c', specSection: '   ' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(3);
    expect(r.rollup.unattributed).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by avgTurnaroundDays desc, ties by submitted desc', () => {
    const r = buildSubmittalBySpecSection({
      submittals: [
        sub({ id: 'fast1', specSection: 'fast', submittedAt: '2026-04-01', returnedAt: '2026-04-05' }),
        sub({ id: 'slow1', specSection: 'slow', submittedAt: '2026-04-01', returnedAt: '2026-04-30' }),
      ],
    });
    expect(r.rows[0]?.specSection).toBe('slow');
  });

  it('respects fromDate / toDate window', () => {
    const r = buildSubmittalBySpecSection({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      submittals: [
        sub({ id: 'old', submittedAt: '2026-03-15' }),
        sub({ id: 'in', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildSubmittalBySpecSection({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
