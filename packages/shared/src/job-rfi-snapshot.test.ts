import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiSnapshot } from './job-rfi-snapshot';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T08:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    number: 1,
    subject: 'Test',
    question: 'Q?',
    status: 'SENT',
    priority: 'MEDIUM',
    sentAt: '2026-04-01T08:00:00Z',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildJobRfiSnapshot', () => {
  it('filters to a single job', () => {
    const r = buildJobRfiSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalRfis).toBe(1);
  });

  it('counts open + overdue', () => {
    const r = buildJobRfiSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', status: 'SENT', responseDueAt: '2026-04-15' }),
        rfi({ id: 'b', status: 'DRAFT' }),
        rfi({ id: 'c', status: 'ANSWERED', answeredAt: '2026-04-10T10:00:00Z' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.overdueCount).toBe(1);
  });

  it('counts cost + schedule impact', () => {
    const r = buildJobRfiSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'b', costImpact: false, scheduleImpact: true }),
      ],
    });
    expect(r.costImpactCount).toBe(1);
    expect(r.scheduleImpactCount).toBe(1);
  });

  it('tracks oldest open age in days', () => {
    const r = buildJobRfiSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', status: 'SENT', sentAt: '2026-04-15T08:00:00Z' }),
        rfi({ id: 'b', status: 'SENT', sentAt: '2026-03-01T08:00:00Z' }),
      ],
    });
    expect(r.oldestOpenAgeDays ?? 0).toBeGreaterThan(50);
  });

  it('breaks down by status + priority', () => {
    const r = buildJobRfiSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      rfis: [
        rfi({ id: 'a', status: 'SENT', priority: 'HIGH' }),
        rfi({ id: 'b', status: 'CLOSED', priority: 'LOW' }),
      ],
    });
    expect(r.byStatus.SENT).toBe(1);
    expect(r.byStatus.CLOSED).toBe(1);
    expect(r.byPriority.HIGH).toBe(1);
    expect(r.byPriority.LOW).toBe(1);
  });

  it('handles no matching rfis', () => {
    const r = buildJobRfiSnapshot({ jobId: 'j1', rfis: [] });
    expect(r.totalRfis).toBe(0);
    expect(r.oldestOpenAgeDays).toBeNull();
  });
});
