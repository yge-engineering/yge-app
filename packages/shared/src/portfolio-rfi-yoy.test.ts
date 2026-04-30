import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildPortfolioRfiYoy } from './portfolio-rfi-yoy';

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

describe('buildPortfolioRfiYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioRfiYoy({
      currentYear: 2026,
      rfis: [
        rfi({ id: 'a', sentAt: '2025-04-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
        rfi({ id: 'c', sentAt: '2026-05-15' }),
      ],
    });
    expect(r.priorTotalSent).toBe(1);
    expect(r.currentTotalSent).toBe(2);
    expect(r.totalSentDelta).toBe(1);
  });

  it('breaks down by priority + counts impact flags + answered', () => {
    const r = buildPortfolioRfiYoy({
      currentYear: 2026,
      rfis: [
        rfi({ id: 'a', priority: 'HIGH', costImpact: true, answeredAt: '2026-04-20' }),
        rfi({ id: 'b', priority: 'CRITICAL', scheduleImpact: true }),
        rfi({ id: 'c', priority: 'HIGH' }),
      ],
    });
    expect(r.currentByPriority.HIGH).toBe(2);
    expect(r.currentByPriority.CRITICAL).toBe(1);
    expect(r.currentAnsweredCount).toBe(1);
    expect(r.currentCostImpactCount).toBe(1);
    expect(r.currentScheduleImpactCount).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioRfiYoy({
      currentYear: 2026,
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
        rfi({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('skips RFIs with no sentAt', () => {
    const r = buildPortfolioRfiYoy({
      currentYear: 2026,
      rfis: [rfi({ id: 'a', sentAt: undefined })],
    });
    expect(r.currentTotalSent).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioRfiYoy({ currentYear: 2026, rfis: [] });
    expect(r.currentTotalSent).toBe(0);
  });
});
