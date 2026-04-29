import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildPortfolioCoMonthly } from './portfolio-co-monthly';

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

describe('buildPortfolioCoMonthly', () => {
  it('counts proposed / approved / executed milestones', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({ id: 'a' }),
        co({ id: 'b', approvedAt: '2026-04-20' }),
        co({ id: 'c', approvedAt: '2026-04-20', executedAt: '2026-04-25' }),
      ],
    });
    expect(r.rows[0]?.proposedCount).toBe(3);
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.executedCount).toBe(1);
  });

  it('sums lineItems amountCents', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({
          id: 'a',
          lineItems: [
            { description: 'a', amountCents: 30_000_00 },
            { description: 'b', amountCents: 20_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
  });

  it('breaks down by reason', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({ id: 'a', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', reason: 'DIFFERING_SITE_CONDITION' }),
        co({ id: 'c', reason: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows[0]?.byReason.OWNER_DIRECTED).toBe(2);
    expect(r.rows[0]?.byReason.DIFFERING_SITE_CONDITION).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
        co({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('skips COs with no proposedAt', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({ id: 'a', proposedAt: undefined }),
        co({ id: 'b' }),
      ],
    });
    expect(r.rollup.noProposedAtSkipped).toBe(1);
    expect(r.rollup.totalCos).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioCoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      changeOrders: [
        co({ id: 'old', proposedAt: '2026-03-15' }),
        co({ id: 'in', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCos).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioCoMonthly({
      changeOrders: [
        co({ id: 'a', proposedAt: '2026-06-15' }),
        co({ id: 'b', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoMonthly({ changeOrders: [] });
    expect(r.rows).toHaveLength(0);
  });
});
