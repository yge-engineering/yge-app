import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildJobCoByReason } from './job-co-by-reason';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'Test',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    executedAt: '2026-04-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildJobCoByReason', () => {
  it('groups by (job, reason)', () => {
    const r = buildJobCoByReason({
      changeOrders: [
        co({ id: 'a', jobId: 'j1', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', jobId: 'j1', reason: 'DIFFERING_SITE_CONDITION' }),
        co({ id: 'c', jobId: 'j2', reason: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('only sums cost + schedule for APPROVED/EXECUTED', () => {
    const r = buildJobCoByReason({
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED', totalCostImpactCents: 99_000_00 }),
        co({ id: 'a', status: 'APPROVED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'e', status: 'EXECUTED', totalCostImpactCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCostImpactCents).toBe(50_000_00);
    expect(r.rows[0]?.executedCount).toBe(2);
  });

  it('respects fromDate / toDate', () => {
    const r = buildJobCoByReason({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      changeOrders: [
        co({ id: 'old', executedAt: '2026-03-15' }),
        co({ id: 'in', executedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCos).toBe(1);
  });

  it('sorts by jobId asc, costImpact desc within job', () => {
    const r = buildJobCoByReason({
      changeOrders: [
        co({ id: 'small', jobId: 'A', reason: 'OWNER_DIRECTED', totalCostImpactCents: 5_000_00 }),
        co({ id: 'big', jobId: 'A', reason: 'DIFFERING_SITE_CONDITION', totalCostImpactCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.reason).toBe('DIFFERING_SITE_CONDITION');
  });

  it('handles empty input', () => {
    const r = buildJobCoByReason({ changeOrders: [] });
    expect(r.rows).toHaveLength(0);
  });
});
