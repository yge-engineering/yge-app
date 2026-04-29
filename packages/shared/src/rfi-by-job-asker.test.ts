import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildRfiByJobAsker } from './rfi-by-job-asker';

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

describe('buildRfiByJobAsker', () => {
  it('groups by (job, asker)', () => {
    const r = buildRfiByJobAsker({
      rfis: [
        rfi({ id: 'a', jobId: 'j1', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'b', jobId: 'j1', askedByEmployeeId: 'brook' }),
        rfi({ id: 'c', jobId: 'j2', askedByEmployeeId: 'ryan' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts answered + impact flags', () => {
    const r = buildRfiByJobAsker({
      rfis: [
        rfi({ id: 'a', costImpact: true }),
        rfi({ id: 'b', scheduleImpact: true }),
        rfi({ id: 'c', status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.rfisAsked).toBe(3);
    expect(r.rows[0]?.answered).toBe(2);
    expect(r.rows[0]?.costImpactCount).toBe(1);
    expect(r.rows[0]?.scheduleImpactCount).toBe(1);
  });

  it('counts unattributed (no askedByEmployeeId)', () => {
    const r = buildRfiByJobAsker({
      rfis: [
        rfi({ id: 'a', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'b', askedByEmployeeId: undefined }),
      ],
    });
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window on sentAt', () => {
    const r = buildRfiByJobAsker({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'old', sentAt: '2026-03-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('sorts by jobId asc, rfisAsked desc within job', () => {
    const r = buildRfiByJobAsker({
      rfis: [
        rfi({ id: 'a', jobId: 'A', askedByEmployeeId: 'small' }),
        rfi({ id: 'b', jobId: 'A', askedByEmployeeId: 'big' }),
        rfi({ id: 'c', jobId: 'A', askedByEmployeeId: 'big' }),
      ],
    });
    expect(r.rows[0]?.askedByEmployeeId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildRfiByJobAsker({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
