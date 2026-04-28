import { describe, expect, it } from 'vitest';

import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildJobRfiPriorityMix } from './job-rfi-priority-mix';

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
    rfiNumber: '1',
    subject: 's',
    question: 'q',
    priority: 'MEDIUM',
    status: 'SENT',
    sentAt: '2026-04-15',
    ...over,
  } as Rfi;
}

describe('buildJobRfiPriorityMix', () => {
  it('counts by priority', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', priority: 'LOW' }),
        rfi({ id: 'b', priority: 'MEDIUM' }),
        rfi({ id: 'c', priority: 'HIGH' }),
        rfi({ id: 'd', priority: 'CRITICAL' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.low).toBe(1);
    expect(row?.medium).toBe(1);
    expect(row?.high).toBe(1);
    expect(row?.critical).toBe(1);
  });

  it('counts open (SENT status) and open high/critical separately', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', priority: 'HIGH', status: 'SENT' }),
        rfi({ id: 'b', priority: 'CRITICAL', status: 'SENT' }),
        rfi({ id: 'c', priority: 'LOW', status: 'SENT' }),
        rfi({ id: 'd', priority: 'HIGH', status: 'ANSWERED' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(3);
    expect(r.rows[0]?.openHighCritical).toBe(2);
  });

  it('sums totalHighCritical across all statuses', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', priority: 'HIGH', status: 'SENT' }),
        rfi({ id: 'b', priority: 'CRITICAL', status: 'ANSWERED' }),
        rfi({ id: 'c', priority: 'LOW' }),
      ],
    });
    expect(r.rows[0]?.totalHighCritical).toBe(2);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      rfis: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts most open-high-critical first', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [
        job({ id: 'clean' }),
        job({ id: 'hot' }),
      ],
      rfis: [
        rfi({ id: 'c1', jobId: 'clean', priority: 'LOW', status: 'SENT' }),
        rfi({ id: 'h1', jobId: 'hot', priority: 'CRITICAL', status: 'SENT' }),
        rfi({ id: 'h2', jobId: 'hot', priority: 'HIGH', status: 'SENT' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('hot');
  });

  it('rolls up portfolio counts', () => {
    const r = buildJobRfiPriorityMix({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'a', priority: 'HIGH', status: 'SENT' }),
        rfi({ id: 'b', priority: 'CRITICAL', status: 'SENT' }),
        rfi({ id: 'c', priority: 'LOW', status: 'ANSWERED' }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(3);
    expect(r.rollup.totalOpen).toBe(2);
    expect(r.rollup.totalOpenHighCritical).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildJobRfiPriorityMix({ jobs: [], rfis: [] });
    expect(r.rows).toHaveLength(0);
  });
});
