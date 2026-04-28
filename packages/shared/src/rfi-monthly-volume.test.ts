import { describe, expect, it } from 'vitest';

import type { Rfi } from './rfi';

import { buildRfiMonthlyVolume } from './rfi-monthly-volume';

function rfi(over: Partial<Rfi>): Rfi {
  return {
    id: 'rfi-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    rfiNumber: '14',
    subject: 's',
    question: 'q',
    priority: 'MEDIUM',
    status: 'SENT',
    sentAt: '2026-04-15',
    ...over,
  } as Rfi;
}

describe('buildRfiMonthlyVolume', () => {
  it('buckets submitted by sentAt month', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-03-15' }),
        rfi({ id: 'b', sentAt: '2026-03-25' }),
        rfi({ id: 'c', sentAt: '2026-04-10' }),
      ],
    });
    const mar = r.rows.find((x) => x.month === '2026-03');
    expect(mar?.submittedCount).toBe(2);
    const apr = r.rows.find((x) => x.month === '2026-04');
    expect(apr?.submittedCount).toBe(1);
  });

  it('buckets answered by answeredAt month (separate from sent)', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        rfi({
          id: 'a',
          sentAt: '2026-03-15',
          answeredAt: '2026-04-05',
          status: 'ANSWERED',
        }),
      ],
    });
    const mar = r.rows.find((x) => x.month === '2026-03');
    const apr = r.rows.find((x) => x.month === '2026-04');
    expect(mar?.submittedCount).toBe(1);
    expect(mar?.answeredCount).toBe(0);
    expect(apr?.submittedCount).toBe(0);
    expect(apr?.answeredCount).toBe(1);
  });

  it('computes median + avg response days per month', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        // 5 days
        rfi({ id: 'a', sentAt: '2026-04-01', answeredAt: '2026-04-06', status: 'ANSWERED' }),
        // 10 days
        rfi({ id: 'b', sentAt: '2026-04-05', answeredAt: '2026-04-15', status: 'ANSWERED' }),
        // 15 days
        rfi({ id: 'c', sentAt: '2026-04-10', answeredAt: '2026-04-25', status: 'ANSWERED' }),
      ],
    });
    const apr = r.rows.find((x) => x.month === '2026-04');
    expect(apr?.medianResponseDays).toBe(10);
    expect(apr?.avgResponseDays).toBe(10);
  });

  it('counts distinct jobs that submitted RFIs in the month', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        rfi({ id: 'a', jobId: 'j1' }),
        rfi({ id: 'b', jobId: 'j2' }),
        rfi({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects month bounds', () => {
    const r = buildRfiMonthlyVolume({
      fromMonth: '2026-03',
      toMonth: '2026-04',
      rfis: [
        rfi({ id: 'jan', sentAt: '2026-01-15' }),
        rfi({ id: 'mar', sentAt: '2026-03-15' }),
        rfi({ id: 'apr', sentAt: '2026-04-15' }),
        rfi({ id: 'may', sentAt: '2026-05-15' }),
      ],
    });
    expect(r.rollup.totalSubmitted).toBe(2);
  });

  it('skips RFIs with no sentAt', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [rfi({ sentAt: undefined })],
    });
    expect(r.rollup.totalSubmitted).toBe(0);
  });

  it('null median + avg when no answered RFIs', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [rfi({ id: 'open', sentAt: '2026-04-15' })],
    });
    expect(r.rows[0]?.medianResponseDays).toBe(null);
    expect(r.rows[0]?.avgResponseDays).toBe(null);
  });

  it('captures peak submitted month', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-03-15' }),
        rfi({ id: 'b', sentAt: '2026-04-15' }),
        rfi({ id: 'c', sentAt: '2026-04-20' }),
        rfi({ id: 'd', sentAt: '2026-04-25' }),
      ],
    });
    expect(r.rollup.peakSubmittedMonth).toBe('2026-04');
    expect(r.rollup.peakSubmittedCount).toBe(3);
  });

  it('computes month-over-month submitted change', () => {
    const r = buildRfiMonthlyVolume({
      rfis: [
        rfi({ id: 'a', sentAt: '2026-03-15' }),
        rfi({ id: 'b', sentAt: '2026-03-20' }),
        rfi({ id: 'c', sentAt: '2026-04-15' }),
        rfi({ id: 'd', sentAt: '2026-04-16' }),
        rfi({ id: 'e', sentAt: '2026-04-17' }),
        rfi({ id: 'f', sentAt: '2026-04-18' }),
      ],
    });
    expect(r.rollup.monthOverMonthSubmittedChange).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildRfiMonthlyVolume({ rfis: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.peakSubmittedMonth).toBe(null);
    expect(r.rollup.blendedMedianDays).toBe(null);
  });
});
