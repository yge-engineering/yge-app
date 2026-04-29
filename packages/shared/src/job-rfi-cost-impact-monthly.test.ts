import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiCostImpactMonthly } from './job-rfi-cost-impact-monthly';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    question: 'Test',
    status: 'ANSWERED',
    priority: 'MEDIUM',
    sentAt: '2026-04-01',
    answeredAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildJobRfiCostImpactMonthly', () => {
  it('groups by (job, answeredAt month)', () => {
    const r = buildJobRfiCostImpactMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'j1', answeredAt: '2026-03-15' }),
        rfi({ id: 'b', jobId: 'j1', answeredAt: '2026-04-15' }),
        rfi({ id: 'c', jobId: 'j2', answeredAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('only counts ANSWERED + CLOSED with answeredAt', () => {
    const r = buildJobRfiCostImpactMonthly({
      rfis: [
        rfi({ id: 'sent', status: 'SENT' }),
        rfi({ id: 'wd', status: 'WITHDRAWN' }),
        rfi({ id: 'noans', status: 'ANSWERED', answeredAt: undefined }),
        rfi({ id: 'a', status: 'ANSWERED' }),
      ],
    });
    expect(r.rollup.totalAnswered).toBe(1);
  });

  it('computes cost + schedule impact rates', () => {
    const r = buildJobRfiCostImpactMonthly({
      rfis: [
        rfi({ id: 'a', costImpact: true }),
        rfi({ id: 'b', scheduleImpact: true }),
        rfi({ id: 'c' }),
        rfi({ id: 'd' }),
      ],
    });
    expect(r.rows[0]?.answered).toBe(4);
    expect(r.rows[0]?.costImpactRate).toBe(0.25);
    expect(r.rows[0]?.scheduleImpactRate).toBe(0.25);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobRfiCostImpactMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'mar', answeredAt: '2026-03-15' }),
        rfi({ id: 'apr', answeredAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalAnswered).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobRfiCostImpactMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'Z', answeredAt: '2026-04-15' }),
        rfi({ id: 'b', jobId: 'A', answeredAt: '2026-04-15' }),
        rfi({ id: 'c', jobId: 'A', answeredAt: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildJobRfiCostImpactMonthly({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
