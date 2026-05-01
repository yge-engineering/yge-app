import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildJobCoDetailSnapshot } from './job-co-detail-snapshot';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '01',
    subject: 'X',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-10',
    lineItems: [],
    totalCostImpactCents: 10_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildJobCoDetailSnapshot', () => {
  it('returns one row per reason sorted by cost impact', () => {
    const r = buildJobCoDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      changeOrders: [
        co({ id: 'a', jobId: 'j1', reason: 'OWNER_DIRECTED', status: 'EXECUTED', totalCostImpactCents: 100_000_00, totalScheduleImpactDays: 14 }),
        co({ id: 'b', jobId: 'j1', reason: 'OWNER_DIRECTED', status: 'PROPOSED' }),
        co({ id: 'c', jobId: 'j1', reason: 'DIFFERING_SITE_CONDITION', status: 'APPROVED', totalCostImpactCents: 25_000_00, totalScheduleImpactDays: 3 }),
        co({ id: 'd', jobId: 'j2', reason: 'OWNER_DIRECTED', status: 'EXECUTED' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.reason).toBe('OWNER_DIRECTED');
    expect(r.rows[0]?.totalCos).toBe(2);
    expect(r.rows[0]?.executed).toBe(1);
    expect(r.rows[0]?.proposed).toBe(1);
    expect(r.rows[0]?.totalCostImpactCents).toBe(100_000_00);
    expect(r.rows[1]?.reason).toBe('DIFFERING_SITE_CONDITION');
    expect(r.rows[1]?.approved).toBe(1);
    expect(r.rows[1]?.totalCostImpactCents).toBe(25_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobCoDetailSnapshot({ jobId: 'X', changeOrders: [] });
    expect(r.rows.length).toBe(0);
  });
});
