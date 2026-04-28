import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildJobRfiResponseHistogram } from './job-rfi-response-histogram';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'j1',
    projectName: 'Sulphur Springs',
    status: 'AWARDED',
    ...over,
  };
}

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
    status: 'ANSWERED',
    sentAt: '2026-04-01',
    answeredAt: '2026-04-05',
    ...over,
  } as Rfi;
}

describe('buildJobRfiResponseHistogram', () => {
  it('buckets answered RFI response times correctly', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'q1', sentAt: '2026-04-01', answeredAt: '2026-04-03' }), // 2  → 0-3
        rfi({ id: 'q2', sentAt: '2026-04-01', answeredAt: '2026-04-06' }), // 5  → 4-7
        rfi({ id: 'q3', sentAt: '2026-04-01', answeredAt: '2026-04-12' }), // 11 → 8-14
        rfi({ id: 'q4', sentAt: '2026-04-01', answeredAt: '2026-04-21' }), // 20 → 15-30
        rfi({ id: 'q5', sentAt: '2026-04-01', answeredAt: '2026-05-15' }), // 44 → 30+
      ],
    });
    const row = r.rows[0];
    expect(row?.bucket0to3).toBe(1);
    expect(row?.bucket4to7).toBe(1);
    expect(row?.bucket8to14).toBe(1);
    expect(row?.bucket15to30).toBe(1);
    expect(row?.bucket30Plus).toBe(1);
  });

  it('counts open RFIs separately', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', status: 'ANSWERED' }),
        rfi({ id: 'o', status: 'SENT', sentAt: '2026-04-01', answeredAt: undefined }),
      ],
    });
    expect(r.rows[0]?.answeredCount).toBe(1);
    expect(r.rows[0]?.openCount).toBe(1);
  });

  it('computes median + mean + max', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01', answeredAt: '2026-04-04' }), // 3
        rfi({ id: 'b', sentAt: '2026-04-01', answeredAt: '2026-04-08' }), // 7
        rfi({ id: 'c', sentAt: '2026-04-01', answeredAt: '2026-04-15' }), // 14
      ],
    });
    expect(r.rows[0]?.medianDays).toBe(7);
    expect(r.rows[0]?.meanDays).toBe(8);
    expect(r.rows[0]?.maxDays).toBe(14);
  });

  it('null stats when no answered', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [job({})],
      rfis: [rfi({ status: 'SENT', answeredAt: undefined })],
    });
    expect(r.rows[0]?.medianDays).toBe(null);
    expect(r.rows[0]?.meanDays).toBe(null);
    expect(r.rows[0]?.maxDays).toBe(null);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      rfis: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts slowest jobs first', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [
        job({ id: 'fast' }),
        job({ id: 'slow' }),
      ],
      rfis: [
        rfi({ id: 'f', jobId: 'fast', sentAt: '2026-04-01', answeredAt: '2026-04-03' }),
        rfi({ id: 's', jobId: 'slow', sentAt: '2026-04-01', answeredAt: '2026-05-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('slow');
  });

  it('rolls up portfolio blended median', () => {
    const r = buildJobRfiResponseHistogram({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', sentAt: '2026-04-01', answeredAt: '2026-04-04' }),  // 3
        rfi({ id: 'b', sentAt: '2026-04-01', answeredAt: '2026-04-11' }),  // 10
        rfi({ id: 'c', sentAt: '2026-04-01', answeredAt: '2026-04-21' }),  // 20
      ],
    });
    expect(r.rollup.blendedMedianDays).toBe(10);
  });

  it('handles empty input', () => {
    const r = buildJobRfiResponseHistogram({ jobs: [], rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
