import { describe, expect, it } from 'vitest';

import type { Job } from './job';

import { buildBidToAwardVariance } from './bid-to-award-variance';

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

describe('buildBidToAwardVariance', () => {
  it('skips jobs missing bid total OR contract value', () => {
    const r = buildBidToAwardVariance({
      jobs: [
        job({ id: 'no-bid' }),
        job({ id: 'no-contract' }),
        job({ id: 'has-both' }),
      ],
      bidTotalByJobId: new Map([
        ['no-contract', 1_000_000_00],
        ['has-both', 1_000_000_00],
      ]),
      contractByJobId: new Map([
        ['no-bid', 1_000_000_00],
        ['has-both', 1_000_000_00],
      ]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('has-both');
  });

  it('flags AWARDED_AT_BID when contract within 1% of bid', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 1_000_000_00]]),
      contractByJobId: new Map([['job-1', 995_000_00]]), // -0.5%
    });
    expect(r.rows[0]?.flag).toBe('AWARDED_AT_BID');
  });

  it('flags TRIMMED_LIGHT for 1-5% trim', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 1_000_000_00]]),
      contractByJobId: new Map([['job-1', 970_000_00]]), // -3%
    });
    expect(r.rows[0]?.flag).toBe('TRIMMED_LIGHT');
  });

  it('flags TRIMMED_MED for 5-15% trim', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 1_000_000_00]]),
      contractByJobId: new Map([['job-1', 900_000_00]]), // -10%
    });
    expect(r.rows[0]?.flag).toBe('TRIMMED_MED');
  });

  it('flags TRIMMED_HEAVY for >15% trim', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 1_000_000_00]]),
      contractByJobId: new Map([['job-1', 800_000_00]]), // -20%
    });
    expect(r.rows[0]?.flag).toBe('TRIMMED_HEAVY');
  });

  it('flags AWARDED_OVER when contract exceeds bid by >1%', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 1_000_000_00]]),
      contractByJobId: new Map([['job-1', 1_050_000_00]]), // +5%
    });
    expect(r.rows[0]?.flag).toBe('AWARDED_OVER');
  });

  it('skips jobs with zero bid', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({})],
      bidTotalByJobId: new Map([['job-1', 0]]),
      contractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows).toHaveLength(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildBidToAwardVariance({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      bidTotalByJobId: new Map([
        ['j-prosp', 100_000_00],
        ['j-awd', 100_000_00],
      ]),
      contractByJobId: new Map([
        ['j-prosp', 100_000_00],
        ['j-awd', 100_000_00],
      ]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals + blended variance', () => {
    const r = buildBidToAwardVariance({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      bidTotalByJobId: new Map([
        ['j1', 1_000_000_00],
        ['j2', 500_000_00],
      ]),
      contractByJobId: new Map([
        ['j1', 950_000_00],
        ['j2', 500_000_00],
      ]),
    });
    expect(r.rollup.totalBidCents).toBe(1_500_000_00);
    expect(r.rollup.totalContractCents).toBe(1_450_000_00);
    expect(r.rollup.totalVarianceCents).toBe(-50_000_00);
    // -50K / 1.5M = -0.0333
    expect(r.rollup.blendedVariancePct).toBeCloseTo(-0.0333, 3);
  });

  it('sorts TRIMMED_HEAVY first', () => {
    const r = buildBidToAwardVariance({
      jobs: [
        job({ id: 'j-at-bid' }),
        job({ id: 'j-heavy' }),
        job({ id: 'j-light' }),
      ],
      bidTotalByJobId: new Map([
        ['j-at-bid', 1_000_000_00],
        ['j-heavy', 1_000_000_00],
        ['j-light', 1_000_000_00],
      ]),
      contractByJobId: new Map([
        ['j-at-bid', 1_000_000_00],
        ['j-heavy', 750_000_00],
        ['j-light', 970_000_00],
      ]),
    });
    expect(r.rows[0]?.jobId).toBe('j-heavy');
  });
});
