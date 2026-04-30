import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildPortfolioRfiSnapshot } from './portfolio-rfi-snapshot';

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

describe('buildPortfolioRfiSnapshot', () => {
  it('counts by status + priority', () => {
    const r = buildPortfolioRfiSnapshot({
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', status: 'SENT', priority: 'HIGH' }),
        rfi({ id: 'b', status: 'ANSWERED', priority: 'LOW' }),
        rfi({ id: 'c', status: 'DRAFT', priority: 'CRITICAL' }),
      ],
    });
    expect(r.byStatus.SENT).toBe(1);
    expect(r.byStatus.ANSWERED).toBe(1);
    expect(r.byStatus.DRAFT).toBe(1);
    expect(r.byPriority.HIGH).toBe(1);
    expect(r.byPriority.CRITICAL).toBe(1);
  });

  it('counts open vs overdue', () => {
    const r = buildPortfolioRfiSnapshot({
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', status: 'SENT', responseDueAt: '2026-04-20' }), // open + overdue
        rfi({ id: 'b', status: 'SENT', responseDueAt: '2026-05-15' }), // open, not overdue
        rfi({ id: 'c', status: 'ANSWERED', responseDueAt: '2026-04-20', answeredAt: '2026-04-22' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
  });

  it('counts cost + schedule impact', () => {
    const r = buildPortfolioRfiSnapshot({
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', costImpact: true }),
        rfi({ id: 'b', scheduleImpact: true }),
      ],
    });
    expect(r.costImpactCount).toBe(1);
    expect(r.scheduleImpactCount).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioRfiSnapshot({
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioRfiSnapshot({ rfis: [] });
    expect(r.totalRfis).toBe(0);
  });
});
