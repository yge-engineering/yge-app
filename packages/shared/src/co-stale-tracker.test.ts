import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildCoStaleReport } from './co-stale-tracker';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Add 2 inches of base rock',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'AGENCY_REVIEW',
    proposedAt: '2026-04-01',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildCoStaleReport', () => {
  it('skips terminal-state COs (EXECUTED, REJECTED, WITHDRAWN)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED' }),
        co({ id: 'co-2', status: 'REJECTED' }),
        co({ id: 'co-3', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.open).toBe(0);
  });

  it('classifies FRESH (<14 days)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [co({ proposedAt: '2026-04-20' })], // 7 days
    });
    expect(r.rows[0]?.staleness).toBe('FRESH');
    expect(r.rows[0]?.daysWaiting).toBe(7);
  });

  it('classifies AGING (14-29 days)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [co({ proposedAt: '2026-04-08' })], // 19 days
    });
    expect(r.rows[0]?.staleness).toBe('AGING');
  });

  it('classifies STALE (30-59 days)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [co({ proposedAt: '2026-03-15' })], // 43 days
    });
    expect(r.rows[0]?.staleness).toBe('STALE');
  });

  it('classifies STUCK (60+ days)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [co({ proposedAt: '2026-01-15' })], // 102 days
    });
    expect(r.rows[0]?.staleness).toBe('STUCK');
  });

  it('rolls up exposure for STALE + STUCK only', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [
        // FRESH — does not count
        co({ id: 'co-1', proposedAt: '2026-04-20', totalCostImpactCents: 10_000_00 }),
        // STALE — counts
        co({ id: 'co-2', proposedAt: '2026-03-15', totalCostImpactCents: 25_000_00 }),
        // STUCK — counts
        co({ id: 'co-3', proposedAt: '2026-01-01', totalCostImpactCents: 40_000_00 }),
      ],
    });
    expect(r.rollup.exposureCents).toBe(25_000_00 + 40_000_00);
    expect(r.rollup.fresh).toBe(1);
    expect(r.rollup.stale).toBe(1);
    expect(r.rollup.stuck).toBe(1);
  });

  it('takes absolute value of cost impact (deducts still represent waiting work)', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [
        co({ id: 'co-1', proposedAt: '2026-01-15', totalCostImpactCents: -8_000_00 }),
      ],
    });
    expect(r.rollup.exposureCents).toBe(8_000_00);
  });

  it('sorts STUCK first, then by days-waiting desc within tier', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [
        co({ id: 'co-fresh', proposedAt: '2026-04-22' }),
        co({ id: 'co-stuck-newer', proposedAt: '2026-02-01' }), // 85 days
        co({ id: 'co-stuck-older', proposedAt: '2026-01-01' }), // 116 days
      ],
    });
    expect(r.rows[0]?.changeOrderId).toBe('co-stuck-older');
    expect(r.rows[1]?.changeOrderId).toBe('co-stuck-newer');
    expect(r.rows[2]?.changeOrderId).toBe('co-fresh');
  });

  it('handles missing proposedAt by treating as 0 days waiting', () => {
    const r = buildCoStaleReport({
      asOf: '2026-04-27',
      changeOrders: [co({ proposedAt: undefined })],
    });
    expect(r.rows[0]?.daysWaiting).toBe(0);
    expect(r.rows[0]?.staleness).toBe('FRESH');
  });
});
