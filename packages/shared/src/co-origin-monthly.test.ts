import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildCoOriginMonthly } from './co-origin-monthly';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: 'CO-01',
    subject: 'subj',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildCoOriginMonthly', () => {
  it('buckets by year-month + reason', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'a', proposedAt: '2026-03-15', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', proposedAt: '2026-03-20', reason: 'OWNER_DIRECTED' }),
        co({ id: 'c', proposedAt: '2026-03-25', reason: 'RFI_RESPONSE' }),
        co({ id: 'd', proposedAt: '2026-04-05', reason: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
    const marOwner = r.rows.find((x) => x.month === '2026-03' && x.reason === 'OWNER_DIRECTED');
    expect(marOwner?.count).toBe(2);
    const marRfi = r.rows.find((x) => x.month === '2026-03' && x.reason === 'RFI_RESPONSE');
    expect(marRfi?.count).toBe(1);
    const aprOwner = r.rows.find((x) => x.month === '2026-04' && x.reason === 'OWNER_DIRECTED');
    expect(aprOwner?.count).toBe(1);
  });

  it('only sums approvedDollarImpactCents on APPROVED + EXECUTED', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED', totalCostImpactCents: 10_000_00 }),
        co({ id: 'a', status: 'APPROVED', totalCostImpactCents: 20_000_00 }),
        co({ id: 'e', status: 'EXECUTED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'r', status: 'REJECTED', totalCostImpactCents: 40_000_00 }),
        co({ id: 'w', status: 'WITHDRAWN', totalCostImpactCents: 50_000_00 }),
      ],
    });
    // Only APPROVED 20K + EXECUTED 30K should contribute.
    expect(r.rows[0]?.approvedDollarImpactCents).toBe(50_000_00);
    expect(r.rows[0]?.count).toBe(5);
  });

  it('handles deduct change orders (negative cost impact)', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'add', status: 'APPROVED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'ded', status: 'APPROVED', totalCostImpactCents: -5_000_00 }),
      ],
    });
    expect(r.rows[0]?.approvedDollarImpactCents).toBe(25_000_00);
  });

  it('skips COs without the chosen date field', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'a', proposedAt: undefined }),
        co({ id: 'b', proposedAt: '2026-04-01' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(1);
  });

  it('respects month bounds', () => {
    const r = buildCoOriginMonthly({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      changeOrders: [
        co({ id: 'jan', proposedAt: '2026-01-15' }),
        co({ id: 'mar', proposedAt: '2026-03-15' }),
        co({ id: 'apr', proposedAt: '2026-04-15' }),
        co({ id: 'may', proposedAt: '2026-05-15' }),
      ],
    });
    expect(r.rollup.totalCount).toBe(2);
    expect(r.rows.map((x) => x.month)).toEqual(['2026-03', '2026-04']);
  });

  it('uses approvedAt when dateField is approvedAt', () => {
    const r = buildCoOriginMonthly({
      dateField: 'approvedAt',
      changeOrders: [
        co({
          id: 'a',
          proposedAt: '2026-01-01',
          approvedAt: '2026-04-15',
          status: 'APPROVED',
        }),
        co({
          id: 'b',
          proposedAt: '2026-04-01',
          approvedAt: undefined,
        }),
      ],
    });
    // 'b' has no approvedAt so it's skipped.
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('captures top reason in rollup', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'a', reason: 'OWNER_DIRECTED', proposedAt: '2026-03-15' }),
        co({ id: 'b', reason: 'OWNER_DIRECTED', proposedAt: '2026-04-15' }),
        co({ id: 'c', reason: 'OWNER_DIRECTED', proposedAt: '2026-04-20' }),
        co({ id: 'd', reason: 'RFI_RESPONSE', proposedAt: '2026-03-15' }),
        co({ id: 'e', reason: 'DIFFERING_SITE_CONDITION', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.topReason).toBe('OWNER_DIRECTED');
    expect(r.rollup.topReasonCount).toBe(3);
  });

  it('sorts rows by month asc then reason asc', () => {
    const r = buildCoOriginMonthly({
      changeOrders: [
        co({ id: 'a', proposedAt: '2026-04-15', reason: 'RFI_RESPONSE' }),
        co({ id: 'b', proposedAt: '2026-03-15', reason: 'OWNER_DIRECTED' }),
        co({ id: 'c', proposedAt: '2026-03-15', reason: 'DIFFERING_SITE_CONDITION' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-03');
    expect(r.rows[0]?.reason).toBe('DIFFERING_SITE_CONDITION');
    expect(r.rows[1]?.reason).toBe('OWNER_DIRECTED');
    expect(r.rows[2]?.month).toBe('2026-04');
  });

  it('handles empty input', () => {
    const r = buildCoOriginMonthly({ changeOrders: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.topReason).toBe(null);
  });
});
