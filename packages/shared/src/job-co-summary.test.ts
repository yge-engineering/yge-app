import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildJobCoSummary } from './job-co-summary';

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
    subject: 'Subgrade',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    proposedAt: '2026-01-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildJobCoSummary', () => {
  it('returns zeros when job has no COs', () => {
    const r = buildJobCoSummary({
      jobs: [job({})],
      changeOrders: [],
    });
    expect(r.rows[0]?.executedCount).toBe(0);
    expect(r.rows[0]?.openCount).toBe(0);
  });

  it('counts executed COs separately from open ones', () => {
    const r = buildJobCoSummary({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'c-1', status: 'EXECUTED', totalCostImpactCents: 50_000_00 }),
        co({ id: 'c-2', status: 'EXECUTED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'c-3', status: 'PROPOSED', totalCostImpactCents: 20_000_00 }),
        co({ id: 'c-4', status: 'AGENCY_REVIEW', totalCostImpactCents: 10_000_00 }),
        co({ id: 'c-5', status: 'APPROVED', totalCostImpactCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.executedCount).toBe(2);
    expect(r.rows[0]?.executedTotalCents).toBe(80_000_00);
    expect(r.rows[0]?.openCount).toBe(3);
    expect(r.rows[0]?.openTotalCents).toBe(35_000_00);
  });

  it('counts REJECTED + WITHDRAWN separately', () => {
    const r = buildJobCoSummary({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'c-1', status: 'REJECTED' }),
        co({ id: 'c-2', status: 'REJECTED' }),
        co({ id: 'c-3', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.rows[0]?.rejectedCount).toBe(2);
    expect(r.rows[0]?.withdrawnCount).toBe(1);
  });

  it('sums net schedule days from executed COs only', () => {
    const r = buildJobCoSummary({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'c-1', status: 'EXECUTED', totalScheduleImpactDays: 10 }),
        co({ id: 'c-2', status: 'EXECUTED', totalScheduleImpactDays: -3 }),
        co({ id: 'c-3', status: 'PROPOSED', totalScheduleImpactDays: 99 }),
      ],
    });
    expect(r.rows[0]?.netScheduleDaysExecuted).toBe(7);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobCoSummary({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('j-awd');
  });

  it('rolls up totals across all jobs', () => {
    const r = buildJobCoSummary({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      changeOrders: [
        co({ id: 'c-1', jobId: 'j1', status: 'EXECUTED', totalCostImpactCents: 100_000_00 }),
        co({ id: 'c-2', jobId: 'j2', status: 'PROPOSED', totalCostImpactCents: 50_000_00 }),
      ],
    });
    expect(r.rollup.totalExecutedCount).toBe(1);
    expect(r.rollup.totalExecutedCents).toBe(100_000_00);
    expect(r.rollup.totalOpenCount).toBe(1);
    expect(r.rollup.totalOpenCents).toBe(50_000_00);
  });

  it('sorts by openTotalCents desc (most pressing in-flight $)', () => {
    const r = buildJobCoSummary({
      jobs: [
        job({ id: 'j-quiet' }),
        job({ id: 'j-active' }),
      ],
      changeOrders: [
        co({ id: 'c-quiet', jobId: 'j-quiet', status: 'EXECUTED', totalCostImpactCents: 1_000_000_00 }),
        co({ id: 'c-active', jobId: 'j-active', status: 'PROPOSED', totalCostImpactCents: 10_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-active');
  });
});
