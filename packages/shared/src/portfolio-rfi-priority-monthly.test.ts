import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildPortfolioRfiPriorityMonthly } from './portfolio-rfi-priority-monthly';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildPortfolioRfiPriorityMonthly', () => {
  it('breaks down by priority per month', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', priority: 'LOW' }),
        rfi({ id: 'b', priority: 'MEDIUM' }),
        rfi({ id: 'c', priority: 'HIGH' }),
        rfi({ id: 'd', priority: 'CRITICAL' }),
        rfi({ id: 'e', priority: 'HIGH' }),
      ],
    });
    expect(r.rows[0]?.low).toBe(1);
    expect(r.rows[0]?.medium).toBe(1);
    expect(r.rows[0]?.high).toBe(2);
    expect(r.rows[0]?.critical).toBe(1);
  });

  it('counts answered + impact flags', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', answeredAt: '2026-04-20', costImpact: true }),
        rfi({ id: 'b', scheduleImpact: true }),
        rfi({ id: 'c', answeredAt: '2026-04-25', costImpact: true, scheduleImpact: true }),
      ],
    });
    expect(r.rows[0]?.answeredCount).toBe(2);
    expect(r.rows[0]?.costImpactCount).toBe(2);
    expect(r.rows[0]?.scheduleImpactCount).toBe(2);
  });

  it('skips RFIs with no sentAt', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', sentAt: undefined }),
        rfi({ id: 'b' }),
      ],
    });
    expect(r.rollup.noSentAtSkipped).toBe(1);
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('counts distinct jobs per month', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
        rfi({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'old', sentAt: '2026-03-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-06-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioRfiPriorityMonthly({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
