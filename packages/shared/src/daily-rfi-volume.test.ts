import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildDailyRfiVolume } from './daily-rfi-volume';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'job-1',
    rfiNumber: '14',
    subject: 's',
    question: 'q',
    priority: 'MEDIUM',
    status: 'SENT',
    sentAt: '2026-04-15',
    ...over,
  } as Rfi;
}

describe('buildDailyRfiVolume', () => {
  it('counts RFIs submitted on sentAt', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
        rfi({ id: 'c', sentAt: '2026-04-20' }),
      ],
    });
    const day15 = r.rows.find((x) => x.date === '2026-04-15');
    expect(day15?.submittedCount).toBe(2);
  });

  it('counts answered on answeredAt', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01', answeredAt: '2026-04-15', status: 'ANSWERED' }),
      ],
    });
    const day15 = r.rows.find((x) => x.date === '2026-04-15');
    expect(day15?.answeredCount).toBe(1);
  });

  it('tracks running cumulative backlog', () => {
    // Day-by-day:
    //   04-01: a sent (+1), c sent (+1)      → running 2
    //   04-02: b sent (+1)                   → running 3
    //   04-03: c answered (-1)               → running 2
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01' }),
        rfi({ id: 'b', sentAt: '2026-04-02' }),
        rfi({ id: 'c', sentAt: '2026-04-01', answeredAt: '2026-04-03', status: 'ANSWERED' }),
      ],
    });
    expect(r.rows[0]?.cumulativeBacklog).toBe(2);
    expect(r.rows[1]?.cumulativeBacklog).toBe(3);
    expect(r.rows[2]?.cumulativeBacklog).toBe(2);
  });

  it('respects openingBacklog', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      openingBacklog: 5,
      rfis: [rfi({ sentAt: '2026-04-15' })],
    });
    expect(r.rows[0]?.cumulativeBacklog).toBe(6);
  });

  it('skips activity outside window', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-15',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'old', sentAt: '2026-04-01' }),
        rfi({ id: 'in', sentAt: '2026-04-20' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(1);
  });

  it('skips RFI without sentAt', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [rfi({ sentAt: undefined })],
    });
    expect(r.rollup.totalSubmitted).toBe(0);
  });

  it('captures peak backlog date', () => {
    // Daily running backlog:
    //   04-01: +2 (a + d sent)              → 2
    //   04-02: +2 (b + e sent)              → 4
    //   04-03: +1 (c sent)                  → 5  ← peak
    //   04-15: -2 (d + e answered)          → 3
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01' }),
        rfi({ id: 'b', sentAt: '2026-04-02' }),
        rfi({ id: 'c', sentAt: '2026-04-03' }),
        rfi({ id: 'd', sentAt: '2026-04-01', answeredAt: '2026-04-15', status: 'ANSWERED' }),
        rfi({ id: 'e', sentAt: '2026-04-02', answeredAt: '2026-04-15', status: 'ANSWERED' }),
      ],
    });
    expect(r.rollup.peakBacklog).toBe(5);
    expect(r.rollup.peakBacklogDate).toBe('2026-04-03');
  });

  it('sorts rows by date asc', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [
        rfi({ id: 'late', sentAt: '2026-04-25' }),
        rfi({ id: 'early', sentAt: '2026-04-05' }),
      ],
    });
    expect(r.rows[0]?.date).toBe('2026-04-05');
  });

  it('handles empty input', () => {
    const r = buildDailyRfiVolume({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      rfis: [],
    });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakBacklogDate).toBe(null);
  });
});
