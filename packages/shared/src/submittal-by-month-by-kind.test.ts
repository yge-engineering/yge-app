import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildSubmittalByMonthByKind } from './submittal-by-month-by-kind';

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

describe('buildSubmittalByMonthByKind', () => {
  it('groups by (month, kind)', () => {
    const r = buildSubmittalByMonthByKind({
      submittals: [
        sub({ id: 'a', kind: 'SHOP_DRAWING', submittedAt: '2026-04-15' }),
        sub({ id: 'b', kind: 'PRODUCT_DATA', submittedAt: '2026-04-15' }),
        sub({ id: 'c', kind: 'SHOP_DRAWING', submittedAt: '2026-03-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts approved (APPROVED + APPROVED_AS_NOTED)', () => {
    const r = buildSubmittalByMonthByKind({
      submittals: [
        sub({ id: 'a', status: 'APPROVED' }),
        sub({ id: 'b', status: 'APPROVED_AS_NOTED' }),
        sub({ id: 'c', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
  });

  it('skips drafts', () => {
    const r = buildSubmittalByMonthByKind({
      submittals: [
        sub({ id: 'live', status: 'SUBMITTED' }),
        sub({ id: 'draft', status: 'DRAFT' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildSubmittalByMonthByKind({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      submittals: [
        sub({ id: 'mar', submittedAt: '2026-03-15' }),
        sub({ id: 'apr', submittedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalSubmittals).toBe(1);
  });

  it('sorts by month asc, kind asc', () => {
    const r = buildSubmittalByMonthByKind({
      submittals: [
        sub({ id: 'a', kind: 'SHOP_DRAWING' }),
        sub({ id: 'b', kind: 'PRODUCT_DATA' }),
      ],
    });
    expect(r.rows[0]?.kind).toBe('PRODUCT_DATA');
  });

  it('handles empty input', () => {
    const r = buildSubmittalByMonthByKind({ submittals: [] });
    expect(r.rows).toHaveLength(0);
  });
});
