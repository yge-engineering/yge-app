import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildPortfolioCoSnapshot } from './portfolio-co-snapshot';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'T',
    description: 'T',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [{ description: 'l', amountCents: 50_000_00 }],
    ...over,
  } as ChangeOrder;
}

describe('buildPortfolioCoSnapshot', () => {
  it('counts by status', () => {
    const r = buildPortfolioCoSnapshot({
      changeOrders: [
        co({ id: 'a', status: 'PROPOSED' }),
        co({ id: 'b', status: 'APPROVED' }),
        co({ id: 'c', status: 'EXECUTED' }),
      ],
    });
    expect(r.byStatus.PROPOSED).toBe(1);
    expect(r.byStatus.APPROVED).toBe(1);
    expect(r.byStatus.EXECUTED).toBe(1);
  });

  it('breaks down by reason', () => {
    const r = buildPortfolioCoSnapshot({
      changeOrders: [
        co({ id: 'a', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', reason: 'DIFFERING_SITE_CONDITION' }),
      ],
    });
    expect(r.byReason.OWNER_DIRECTED).toBe(1);
    expect(r.byReason.DIFFERING_SITE_CONDITION).toBe(1);
  });

  it('sums lineItems amount', () => {
    const r = buildPortfolioCoSnapshot({
      changeOrders: [
        co({ id: 'a', lineItems: [{ description: 'a', amountCents: 30_000_00 }] }),
        co({ id: 'b', lineItems: [{ description: 'b', amountCents: 20_000_00 }] }),
      ],
    });
    expect(r.totalAmountCents).toBe(50_000_00);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioCoSnapshot({
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoSnapshot({ changeOrders: [] });
    expect(r.totalCos).toBe(0);
  });
});
