import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildContractWaterfall } from './contract-value-waterfall';

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

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Add subgrade',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    proposedAt: '2026-01-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildContractWaterfall', () => {
  it('returns original contract when no COs exist', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.originalContractCents).toBe(1_000_000_00);
    expect(r.rows[0]?.executedAddsCents).toBe(0);
    expect(r.rows[0]?.currentContractCents).toBe(1_000_000_00);
    expect(r.rows[0]?.openCoUpsideCents).toBe(0);
    expect(r.rows[0]?.potentialContractCents).toBe(1_000_000_00);
  });

  it('adds executed CO impact (signed) to current contract', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', totalCostImpactCents: 100_000_00 }),
        co({ id: 'co-2', status: 'EXECUTED', totalCostImpactCents: -25_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.executedAddsCents).toBe(75_000_00);
    expect(r.rows[0]?.currentContractCents).toBe(1_075_000_00);
    expect(r.rows[0]?.executedCoCount).toBe(2);
  });

  it('counts open COs (PROPOSED, AGENCY_REVIEW, APPROVED) as upside', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'PROPOSED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'co-2', status: 'AGENCY_REVIEW', totalCostImpactCents: 20_000_00 }),
        co({ id: 'co-3', status: 'APPROVED', totalCostImpactCents: 10_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.openCoUpsideCents).toBe(60_000_00);
    expect(r.rows[0]?.openCoCount).toBe(3);
    expect(r.rows[0]?.potentialContractCents).toBe(1_060_000_00);
  });

  it('ignores REJECTED and WITHDRAWN COs', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'REJECTED', totalCostImpactCents: 99_000_00 }),
        co({ id: 'co-2', status: 'WITHDRAWN', totalCostImpactCents: 99_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.executedAddsCents).toBe(0);
    expect(r.rows[0]?.openCoUpsideCents).toBe(0);
  });

  it('computes openUpsidePct against current contract', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'PROPOSED', totalCostImpactCents: 200_000_00 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.openUpsidePct).toBe(0.2);
  });

  it('handles zero contract gracefully', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'PROPOSED', totalCostImpactCents: 50_000_00 }),
      ],
      originalContractByJobId: new Map(),
    });
    expect(r.rows[0]?.currentContractCents).toBe(0);
    expect(r.rows[0]?.openUpsidePct).toBe(0);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildContractWaterfall({
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awarded', status: 'AWARDED' }),
      ],
      changeOrders: [],
      originalContractByJobId: new Map([
        ['job-prosp', 1_000_000_00],
        ['job-awarded', 1_000_000_00],
      ]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awarded');
  });

  it('aggregates schedule days across executed COs only', () => {
    const r = buildContractWaterfall({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'EXECUTED', totalScheduleImpactDays: 7 }),
        co({ id: 'co-2', status: 'EXECUTED', totalScheduleImpactDays: 3 }),
        co({ id: 'co-3', status: 'PROPOSED', totalScheduleImpactDays: 99 }),
      ],
      originalContractByJobId: new Map([['job-1', 1_000_000_00]]),
    });
    expect(r.rows[0]?.netScheduleDaysAdded).toBe(10);
  });

  it('rolls up totals across all jobs', () => {
    const r = buildContractWaterfall({
      jobs: [
        job({ id: 'job-1' }),
        job({ id: 'job-2' }),
      ],
      changeOrders: [
        co({ id: 'co-1', jobId: 'job-1', status: 'EXECUTED', totalCostImpactCents: 100_000_00 }),
        co({ id: 'co-2', jobId: 'job-2', status: 'PROPOSED', totalCostImpactCents: 50_000_00 }),
      ],
      originalContractByJobId: new Map([
        ['job-1', 1_000_000_00],
        ['job-2', 500_000_00],
      ]),
    });
    expect(r.rollup.totalOriginalCents).toBe(1_500_000_00);
    expect(r.rollup.totalExecutedAddsCents).toBe(100_000_00);
    expect(r.rollup.totalCurrentCents).toBe(1_600_000_00);
    expect(r.rollup.totalOpenUpsideCents).toBe(50_000_00);
    expect(r.rollup.totalPotentialCents).toBe(1_650_000_00);
  });

  it('sorts rows by current contract value desc', () => {
    const r = buildContractWaterfall({
      jobs: [
        job({ id: 'job-small' }),
        job({ id: 'job-big' }),
      ],
      changeOrders: [],
      originalContractByJobId: new Map([
        ['job-small', 100_000_00],
        ['job-big', 5_000_000_00],
      ]),
    });
    expect(r.rows[0]?.jobId).toBe('job-big');
    expect(r.rows[1]?.jobId).toBe('job-small');
  });
});
