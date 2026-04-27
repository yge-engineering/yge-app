import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildJobOverheadAllocation } from './job-overhead-allocation';

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

describe('buildJobOverheadAllocation', () => {
  it('allocates overhead by direct-cost share', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      directCostByJobId: new Map([
        ['j1', 800_000_00],
        ['j2', 200_000_00],
      ]),
      totalOverheadCents: 100_000_00,
    });
    const j1 = r.rows.find((x) => x.jobId === 'j1');
    const j2 = r.rows.find((x) => x.jobId === 'j2');
    expect(j1?.directShare).toBe(0.8);
    expect(j1?.allocatedOverheadCents).toBe(80_000_00);
    expect(j2?.directShare).toBe(0.2);
    expect(j2?.allocatedOverheadCents).toBe(20_000_00);
  });

  it('computes loaded cost as direct + allocated', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({})],
      directCostByJobId: new Map([['job-1', 1_000_000_00]]),
      totalOverheadCents: 200_000_00,
    });
    expect(r.rows[0]?.loadedCostCents).toBe(1_200_000_00);
  });

  it('handles zero-direct jobs (gets 0 share, 0 overhead)', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({ id: 'j-active' }), job({ id: 'j-no-cost' })],
      directCostByJobId: new Map([
        ['j-active', 1_000_000_00],
      ]),
      totalOverheadCents: 100_000_00,
    });
    const noCost = r.rows.find((x) => x.jobId === 'j-no-cost');
    expect(noCost?.allocatedOverheadCents).toBe(0);
    expect(noCost?.directShare).toBe(0);
  });

  it('handles zero total direct (returns all 0)', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({})],
      directCostByJobId: new Map(),
      totalOverheadCents: 100_000_00,
    });
    expect(r.rows[0]?.allocatedOverheadCents).toBe(0);
    expect(r.rows[0]?.directShare).toBe(0);
  });

  it('handles zero overhead (everyone gets 0)', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({})],
      directCostByJobId: new Map([['job-1', 1_000_000_00]]),
      totalOverheadCents: 0,
    });
    expect(r.rows[0]?.allocatedOverheadCents).toBe(0);
    expect(r.rows[0]?.loadedCostCents).toBe(1_000_000_00);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobOverheadAllocation({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      directCostByJobId: new Map([
        ['j-prosp', 1_000_000_00],
        ['j-awd', 1_000_000_00],
      ]),
      totalOverheadCents: 100_000_00,
    });
    expect(r.rows).toHaveLength(1);
    // All overhead allocated to the one AWARDED job.
    expect(r.rows[0]?.allocatedOverheadCents).toBe(100_000_00);
  });

  it('rolls up totals + sums allocated near total overhead', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' }), job({ id: 'j3' })],
      directCostByJobId: new Map([
        ['j1', 333_333_00],
        ['j2', 333_333_00],
        ['j3', 333_334_00],
      ]),
      totalOverheadCents: 100_000_00,
    });
    expect(r.rollup.totalDirectCostCents).toBe(1_000_000_00);
    expect(r.rollup.totalOverheadCents).toBe(100_000_00);
    expect(r.rollup.totalLoadedCostCents).toBe(1_100_000_00);
    // Allocated total may be off by 1-2 cents due to rounding.
    expect(Math.abs(r.rollup.totalAllocatedCents - 100_000_00)).toBeLessThan(5);
  });

  it('sorts highest loaded cost first', () => {
    const r = buildJobOverheadAllocation({
      jobs: [job({ id: 'small' }), job({ id: 'big' })],
      directCostByJobId: new Map([
        ['small', 100_000_00],
        ['big', 1_000_000_00],
      ]),
      totalOverheadCents: 100_000_00,
    });
    expect(r.rows[0]?.jobId).toBe('big');
    expect(r.rows[1]?.jobId).toBe('small');
  });
});
