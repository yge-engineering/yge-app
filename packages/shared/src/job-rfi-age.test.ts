import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildJobRfiAge } from './job-rfi-age';

function job(over: Partial<Pick<Job, 'id' | 'projectName' | 'status'>>): Pick<
  Job,
  'id' | 'projectName' | 'status'
> {
  return {
    id: 'job-1',
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
    jobId: 'job-1',
    rfiNumber: '14',
    subject: 'Curb detail',
    question: 'Q?',
    priority: 'MEDIUM',
    status: 'SENT',
    sentAt: '2026-04-01',
    ...over,
  } as Rfi;
}

describe('buildJobRfiAge', () => {
  it('only counts SENT RFIs as open', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r-1', status: 'SENT' }),
        rfi({ id: 'r-2', status: 'ANSWERED' }),
        rfi({ id: 'r-3', status: 'CLOSED' }),
        rfi({ id: 'r-4', status: 'WITHDRAWN' }),
        rfi({ id: 'r-5', status: 'DRAFT' }),
      ],
    });
    expect(r.rows[0]?.openRfiCount).toBe(1);
  });

  it('classifies FRESH (<7 days)', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [rfi({ sentAt: '2026-04-25' })], // 2 days
    });
    expect(r.rows[0]?.fresh).toBe(1);
  });

  it('classifies AGING (7-13 days)', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [rfi({ sentAt: '2026-04-18' })], // 9 days
    });
    expect(r.rows[0]?.aging).toBe(1);
  });

  it('classifies STALE (14-29 days)', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [rfi({ sentAt: '2026-04-10' })], // 17 days
    });
    expect(r.rows[0]?.stale).toBe(1);
  });

  it('classifies STUCK (30+ days)', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [rfi({ sentAt: '2026-03-15' })], // 43 days
    });
    expect(r.rows[0]?.stuck).toBe(1);
    expect(r.rollup.stuckJobsCount).toBe(1);
  });

  it('captures the oldest open RFI sentAt and days', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r-newer', sentAt: '2026-04-20' }),
        rfi({ id: 'r-older', sentAt: '2026-03-01' }),
        rfi({ id: 'r-mid', sentAt: '2026-04-10' }),
      ],
    });
    expect(r.rows[0]?.oldestOpenSentAt).toBe('2026-03-01');
    expect(r.rows[0]?.oldestOpenDaysSinceSent).toBe(57);
  });

  it('returns null oldest when no open RFIs', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({})],
      rfis: [],
    });
    expect(r.rows[0]?.oldestOpenSentAt).toBe(null);
    expect(r.rows[0]?.oldestOpenDaysSinceSent).toBe(null);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awd', status: 'AWARDED' }),
      ],
      rfis: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awd');
  });

  it('rolls up totals + stuckJobsCount', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      rfis: [
        rfi({ id: 'r-1', jobId: 'j1', sentAt: '2026-04-25' }),  // FRESH
        rfi({ id: 'r-2', jobId: 'j2', sentAt: '2026-03-01' }),  // STUCK
        rfi({ id: 'r-3', jobId: 'j2', sentAt: '2026-03-10' }),  // STUCK
      ],
    });
    expect(r.rollup.totalOpen).toBe(3);
    expect(r.rollup.totalFresh).toBe(1);
    expect(r.rollup.totalStuck).toBe(2);
    expect(r.rollup.stuckJobsCount).toBe(1);
  });

  it('sorts most-stuck job first', () => {
    const r = buildJobRfiAge({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'j-fresh' }),
        job({ id: 'j-stuck' }),
      ],
      rfis: [
        rfi({ id: 'r-1', jobId: 'j-fresh', sentAt: '2026-04-25' }),
        rfi({ id: 'r-2', jobId: 'j-stuck', sentAt: '2026-03-01' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-stuck');
  });
});
