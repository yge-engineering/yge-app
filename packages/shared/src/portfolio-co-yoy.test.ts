import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildPortfolioCoYoy } from './portfolio-co-yoy';

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

describe('buildPortfolioCoYoy', () => {
  it('compares prior vs current proposed counts + amount', () => {
    const r = buildPortfolioCoYoy({
      currentYear: 2026,
      changeOrders: [
        co({ id: 'a', proposedAt: '2025-04-15' }),
        co({ id: 'b', proposedAt: '2026-04-15', lineItems: [{ description: 'a', amountCents: 100_000_00 }] }),
      ],
    });
    expect(r.priorProposedCount).toBe(1);
    expect(r.currentProposedCount).toBe(1);
    expect(r.priorTotalAmountCents).toBe(50_000_00);
    expect(r.currentTotalAmountCents).toBe(100_000_00);
    expect(r.totalAmountCentsDelta).toBe(50_000_00);
  });

  it('counts approved + executed milestones', () => {
    const r = buildPortfolioCoYoy({
      currentYear: 2026,
      changeOrders: [
        co({ id: 'a', proposedAt: '2026-04-15', approvedAt: '2026-04-20', executedAt: '2026-04-25' }),
        co({ id: 'b', proposedAt: '2026-04-16' }),
      ],
    });
    expect(r.currentApprovedCount).toBe(1);
    expect(r.currentExecutedCount).toBe(1);
  });

  it('breaks down by reason', () => {
    const r = buildPortfolioCoYoy({
      currentYear: 2026,
      changeOrders: [
        co({ id: 'a', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', reason: 'DIFFERING_SITE_CONDITION' }),
      ],
    });
    expect(r.currentByReason.OWNER_DIRECTED).toBe(1);
    expect(r.currentByReason.DIFFERING_SITE_CONDITION).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioCoYoy({
      currentYear: 2026,
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('skips COs with no proposedAt', () => {
    const r = buildPortfolioCoYoy({
      currentYear: 2026,
      changeOrders: [co({ id: 'a', proposedAt: undefined })],
    });
    expect(r.currentProposedCount).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioCoYoy({ currentYear: 2026, changeOrders: [] });
    expect(r.currentProposedCount).toBe(0);
  });
});
