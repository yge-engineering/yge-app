import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildRfiPriorityMonthly } from './rfi-priority-monthly';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    question: 'Test',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildRfiPriorityMonthly', () => {
  it('buckets by yyyy-mm of sentAt', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-03-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each priority separately', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'l', priority: 'LOW' }),
        rfi({ id: 'm', priority: 'MEDIUM' }),
        rfi({ id: 'h', priority: 'HIGH' }),
        rfi({ id: 'c', priority: 'CRITICAL' }),
      ],
    });
    expect(r.rows[0]?.low).toBe(1);
    expect(r.rows[0]?.medium).toBe(1);
    expect(r.rows[0]?.high).toBe(1);
    expect(r.rows[0]?.critical).toBe(1);
    expect(r.rows[0]?.total).toBe(4);
  });

  it('counts distinct jobs per month', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
        rfi({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildRfiPriorityMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'mar', sentAt: '2026-03-15' }),
        rfi({ id: 'apr', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('falls back to createdAt slice when sentAt missing', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'draft', sentAt: undefined, createdAt: '2026-04-01T00:00:00.000Z' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('computes month-over-month critical change', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'mar', sentAt: '2026-03-15', priority: 'CRITICAL' }),
        rfi({ id: 'apr1', sentAt: '2026-04-10', priority: 'CRITICAL' }),
        rfi({ id: 'apr2', sentAt: '2026-04-15', priority: 'CRITICAL' }),
        rfi({ id: 'apr3', sentAt: '2026-04-20', priority: 'CRITICAL' }),
      ],
    });
    expect(r.rollup.monthOverMonthCriticalChange).toBe(2);
  });

  it('sorts by month asc', () => {
    const r = buildRfiPriorityMonthly({
      rfis: [
        rfi({ id: 'late', sentAt: '2026-04-15' }),
        rfi({ id: 'early', sentAt: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildRfiPriorityMonthly({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
