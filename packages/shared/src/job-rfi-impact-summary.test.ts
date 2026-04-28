import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiImpactSummary } from './job-rfi-impact-summary';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r1',
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

describe('buildJobRfiImpactSummary', () => {
  it('counts cost and schedule impact independently', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'a', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'b', costImpact: false, scheduleImpact: true }),
        rfi({ id: 'c', costImpact: true, scheduleImpact: true }),
      ],
    });
    expect(r.rows[0]?.costImpactCount).toBe(2);
    expect(r.rows[0]?.scheduleImpactCount).toBe(2);
    expect(r.rows[0]?.bothImpactCount).toBe(1);
  });

  it('counts no-impact RFIs', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'clean1' }),
        rfi({ id: 'clean2' }),
      ],
    });
    expect(r.rows[0]?.noImpactCount).toBe(2);
  });

  it('skips RFIs not yet answered', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'sent', status: 'SENT' }),
        rfi({ id: 'wd', status: 'WITHDRAWN' }),
        rfi({ id: 'draft', status: 'DRAFT' }),
        rfi({ id: 'done', status: 'CLOSED', costImpact: true }),
      ],
    });
    expect(r.rollup.rfisConsidered).toBe(1);
    expect(r.rollup.costImpactCount).toBe(1);
  });

  it('groups by jobId', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('computes impact rates per job', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'a', costImpact: true }),
        rfi({ id: 'b', costImpact: true }),
        rfi({ id: 'c', costImpact: false }),
        rfi({ id: 'd', costImpact: false }),
      ],
    });
    expect(r.rows[0]?.costImpactRate).toBe(0.5);
  });

  it('respects fromDate / toDate window on answeredAt', () => {
    const r = buildJobRfiImpactSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'old', answeredAt: '2026-03-15' }),
        rfi({ id: 'in', answeredAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.rfisConsidered).toBe(1);
  });

  it('sorts by costImpactCount desc, ties by scheduleImpactCount desc', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'a1', jobId: 'A', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'a2', jobId: 'A', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'b1', jobId: 'B', costImpact: false, scheduleImpact: true }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
  });

  it('rolls up portfolio totals + impact rates', () => {
    const r = buildJobRfiImpactSummary({
      rfis: [
        rfi({ id: 'a', jobId: 'A', costImpact: true }),
        rfi({ id: 'b', jobId: 'B', scheduleImpact: true }),
        rfi({ id: 'c', jobId: 'B' }),
        rfi({ id: 'd', jobId: 'A' }),
      ],
    });
    expect(r.rollup.rfisConsidered).toBe(4);
    expect(r.rollup.costImpactCount).toBe(1);
    expect(r.rollup.scheduleImpactCount).toBe(1);
    expect(r.rollup.portfolioCostImpactRate).toBe(0.25);
  });

  it('handles empty input', () => {
    const r = buildJobRfiImpactSummary({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
