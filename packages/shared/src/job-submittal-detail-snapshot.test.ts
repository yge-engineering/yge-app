import { describe, expect, it } from 'vitest';

import type { Submittal } from './submittal';

import { buildJobSubmittalDetailSnapshot } from './job-submittal-detail-snapshot';

function sb(over: Partial<Submittal>): Submittal {
  return {
    id: 'sb-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    submittalNumber: '1',
    subject: 'X',
    kind: 'SHOP_DRAWING',
    status: 'SUBMITTED',
    blocksOrdering: false,
    submittedAt: '2026-04-10',
    ...over,
  } as Submittal;
}

describe('buildJobSubmittalDetailSnapshot', () => {
  it('returns one row per kind sorted by total', () => {
    const r = buildJobSubmittalDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      submittals: [
        sb({ id: 'a', jobId: 'j1', kind: 'SHOP_DRAWING', status: 'APPROVED', submittedAt: '2026-04-10', returnedAt: '2026-04-17' }),
        sb({ id: 'b', jobId: 'j1', kind: 'SHOP_DRAWING', status: 'SUBMITTED' }),
        sb({ id: 'c', jobId: 'j1', kind: 'PRODUCT_DATA', status: 'REVISE_RESUBMIT', submittedAt: '2026-04-14', returnedAt: '2026-04-20' }),
        sb({ id: 'd', jobId: 'j2', kind: 'SHOP_DRAWING', status: 'APPROVED' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.kind).toBe('SHOP_DRAWING');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.approved).toBe(1);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.avgDaysToReturn).toBe(7);
    expect(r.rows[1]?.kind).toBe('PRODUCT_DATA');
    expect(r.rows[1]?.reviseResubmit).toBe(1);
    expect(r.rows[1]?.avgDaysToReturn).toBe(6);
  });

  it('handles unknown job', () => {
    const r = buildJobSubmittalDetailSnapshot({ jobId: 'X', submittals: [] });
    expect(r.rows.length).toBe(0);
  });
});
