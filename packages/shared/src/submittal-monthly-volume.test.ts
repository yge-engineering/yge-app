import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalMonthlyVolume } from './submittal-monthly-volume';

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

describe('buildSubmittalMonthlyVolume', () => {
  it('buckets by yyyy-mm of submittedAt', () => {
    const r = buildSubmittalMonthlyVolume({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-03-15' }),
        sub({ id: 'b', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each status separately', () => {
    const r = buildSubmittalMonthlyVolume({
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
    expect(r.rows[0]?.submitted).toBe(1);
  });

  it('skips drafts', () => {
    const r = buildSubmittalMonthlyVolume({
      submittals: [
        sub({ id: 'live', status: 'SUBMITTED' }),
        sub({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('counts blocksOrdering', () => {
    const r = buildSubmittalMonthlyVolume({
      submittals: [
        sub({ id: 'a', blocksOrdering: true }),
        sub({ id: 'b', blocksOrdering: false }),
      ],
    });
    expect(r.rows[0]?.blockedOrderingCount).toBe(1);
  });

  it('computes avg turnaround days', () => {
    const r = buildSubmittalMonthlyVolume({
      submittals: [
        sub({ id: 'a', submittedAt: '2026-04-01', returnedAt: '2026-04-15' }),
        sub({ id: 'b', submittedAt: '2026-04-01', returnedAt: '2026-04-08' }),
      ],
    });
    expect(r.rows[0]?.avgTurnaroundDays).toBe(10.5);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildSubmittalMonthlyVolume({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      submittals: [
        sub({ id: 'mar', submittedAt: '2026-03-15' }),
        sub({ id: 'apr', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('computes month-over-month change', () => {
    const r = buildSubmittalMonthlyVolume({
      submittals: [
        sub({ id: 'mar', submittedAt: '2026-03-15' }),
        sub({ id: 'apr1', submittedAt: '2026-04-10' }),
        sub({ id: 'apr2', submittedAt: '2026-04-20' }),
      ],
    });
    expect(r.rollup.monthOverMonthChange).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildSubmittalMonthlyVolume({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
