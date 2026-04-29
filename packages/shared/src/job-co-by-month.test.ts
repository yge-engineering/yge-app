import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildJobCoByMonth } from './job-co-by-month';

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

describe('buildJobCoByMonth', () => {
  it('groups by (jobId, month)', () => {
    const r = buildJobCoByMonth({
      changeOrders: [
        co({ id: 'a', jobId: 'j1', executedAt: '2026-03-15' }),
        co({ id: 'b', jobId: 'j1', executedAt: '2026-04-15' }),
        co({ id: 'c', jobId: 'j2', executedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts each status separately', () => {
    const r = buildJobCoByMonth({
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED' }),
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'e', status: 'EXECUTED' }),
      ],
    });
    expect(r.rows[0]?.proposedCount).toBe(1);
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.executedCount).toBe(1);
  });

  it('only sums cost + schedule for APPROVED/EXECUTED', () => {
    const r = buildJobCoByMonth({
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED', totalCostImpactCents: 99_000_00 }),
        co({ id: 'a', status: 'APPROVED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'e', status: 'EXECUTED', totalCostImpactCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCostImpactCents).toBe(50_000_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobCoByMonth({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      changeOrders: [
        co({ id: 'mar', executedAt: '2026-03-15' }),
        co({ id: 'apr', executedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCos).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobCoByMonth({
      changeOrders: [
        co({ id: 'a', jobId: 'Z', executedAt: '2026-04-15' }),
        co({ id: 'b', jobId: 'A', executedAt: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildJobCoByMonth({ changeOrders: [] });
    expect(r.rows).toHaveLength(0);
  });
});
