import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildJobRfiMonthly } from './job-rfi-monthly';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    question: 'Test',
    askedByEmployeeId: 'ryan',
    status: 'ANSWERED',
    priority: 'MEDIUM',
    sentAt: '2026-04-15',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildJobRfiMonthly', () => {
  it('groups by (jobId, month)', () => {
    const r = buildJobRfiMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'j1', sentAt: '2026-03-15' }),
        rfi({ id: 'b', jobId: 'j1', sentAt: '2026-04-15' }),
        rfi({ id: 'c', jobId: 'j2', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts answered and impact flags', () => {
    const r = buildJobRfiMonthly({
      rfis: [
        rfi({ id: 'a', status: 'ANSWERED', costImpact: true }),
        rfi({ id: 'b', status: 'CLOSED', scheduleImpact: true }),
        rfi({ id: 'c', status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.answered).toBe(2);
    expect(r.rows[0]?.costImpactCount).toBe(1);
    expect(r.rows[0]?.scheduleImpactCount).toBe(1);
  });

  it('counts distinct askers per pair', () => {
    const r = buildJobRfiMonthly({
      rfis: [
        rfi({ id: 'a', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'b', askedByEmployeeId: 'brook' }),
        rfi({ id: 'c', askedByEmployeeId: 'ryan' }),
      ],
    });
    expect(r.rows[0]?.distinctAskers).toBe(2);
  });

  it('falls back to createdAt slice when sentAt missing', () => {
    const r = buildJobRfiMonthly({
      rfis: [rfi({ sentAt: undefined, createdAt: '2026-04-01T00:00:00.000Z' })],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobRfiMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'mar', sentAt: '2026-03-15' }),
        rfi({ id: 'apr', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobRfiMonthly({
      rfis: [
        rfi({ id: 'a', jobId: 'Z', sentAt: '2026-04-15' }),
        rfi({ id: 'b', jobId: 'A', sentAt: '2026-04-15' }),
        rfi({ id: 'c', jobId: 'A', sentAt: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-03');
  });

  it('handles empty input', () => {
    const r = buildJobRfiMonthly({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
