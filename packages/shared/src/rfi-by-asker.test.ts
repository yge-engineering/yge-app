import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildRfiByAsker } from './rfi-by-asker';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'r1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '1',
    subject: 'Test',
    question: 'Test',
    askedByEmployeeId: 'ryan',
    status: 'ANSWERED',
    priority: 'MEDIUM',
    sentAt: '2026-04-01',
    answeredAt: '2026-04-08',
    costImpact: false,
    scheduleImpact: false,
    ...over,
  } as Rfi;
}

describe('buildRfiByAsker', () => {
  it('groups RFIs by askedByEmployeeId', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 'a', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'b', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'c', askedByEmployeeId: 'brook' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
    const ryan = r.rows.find((x) => x.askedByEmployeeId === 'ryan');
    expect(ryan?.rfisAsked).toBe(2);
  });

  it('counts answered, cost-impact, schedule-impact', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 'a', costImpact: true, scheduleImpact: false }),
        rfi({ id: 'b', costImpact: false, scheduleImpact: true }),
        rfi({ id: 'c', status: 'SENT', costImpact: true }),
      ],
    });
    const row = r.rows[0];
    expect(row?.rfisAsked).toBe(3);
    expect(row?.answeredCount).toBe(2);
    expect(row?.costImpactCount).toBe(1);
    expect(row?.scheduleImpactCount).toBe(1);
  });

  it('computes avg response days from sentAt → answeredAt', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01', answeredAt: '2026-04-08' }),
        rfi({ id: 'b', sentAt: '2026-04-01', answeredAt: '2026-04-04' }),
      ],
    });
    expect(r.rows[0]?.avgResponseDays).toBe(5);
  });

  it('counts distinct jobs touched', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
        rfi({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('counts unattributed RFIs in rollup but not in rows', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 'a', askedByEmployeeId: 'ryan' }),
        rfi({ id: 'b', askedByEmployeeId: undefined }),
        rfi({ id: 'c', askedByEmployeeId: '   ' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(3);
    expect(r.rollup.unattributedRfis).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromDate / toDate window on sentAt', () => {
    const r = buildRfiByAsker({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'old', sentAt: '2026-03-15' }),
        rfi({ id: 'in', sentAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(1);
  });

  it('sorts askers by rfisAsked desc', () => {
    const r = buildRfiByAsker({
      rfis: [
        rfi({ id: 's', askedByEmployeeId: 'small' }),
        rfi({ id: 'b1', askedByEmployeeId: 'big' }),
        rfi({ id: 'b2', askedByEmployeeId: 'big' }),
        rfi({ id: 'b3', askedByEmployeeId: 'big' }),
      ],
    });
    expect(r.rows[0]?.askedByEmployeeId).toBe('big');
  });

  it('handles empty input', () => {
    const r = buildRfiByAsker({ rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
