import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildJobCoWinRate } from './job-co-win-rate';

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

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 's',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'APPROVED',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildJobCoWinRate', () => {
  it('counts approved (APPROVED + EXECUTED) and computes rate', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'b', status: 'EXECUTED' }),
        co({ id: 'c', status: 'REJECTED' }),
        co({ id: 'd', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.rows[0]?.approvedCount).toBe(2);
    expect(r.rows[0]?.proposedCount).toBe(4);
    expect(r.rows[0]?.approvalRate).toBe(0.5);
  });

  it('counts each non-approval status separately', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'r', status: 'REJECTED' }),
        co({ id: 'w', status: 'WITHDRAWN' }),
        co({ id: 'g', status: 'AGENCY_REVIEW' }),
      ],
    });
    const row = r.rows[0];
    expect(row?.approvedCount).toBe(1);
    expect(row?.rejectedCount).toBe(1);
    expect(row?.withdrawnCount).toBe(1);
    expect(row?.agencyReviewCount).toBe(1);
  });

  it('sums approvedDollarImpactCents only for APPROVED + EXECUTED', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED', totalCostImpactCents: 30_000_00 }),
        co({ id: 'e', status: 'EXECUTED', totalCostImpactCents: 20_000_00 }),
        co({ id: 'r', status: 'REJECTED', totalCostImpactCents: 999_999_00 }),
      ],
    });
    expect(r.rows[0]?.approvedDollarImpactCents).toBe(50_000_00);
  });

  it('flags STRONG at >= 80%', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'b', status: 'APPROVED' }),
        co({ id: 'c', status: 'APPROVED' }),
        co({ id: 'd', status: 'APPROVED' }),
        co({ id: 'r', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('STRONG');
  });

  it('flags POOR below 25%', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'r1', status: 'REJECTED' }),
        co({ id: 'r2', status: 'REJECTED' }),
        co({ id: 'r3', status: 'REJECTED' }),
        co({ id: 'r4', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.flag).toBe('POOR');
  });

  it('falls back to OK below minProposedForFlag', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'r1', status: 'REJECTED' }),
        co({ id: 'r2', status: 'REJECTED' }),
      ],
    });
    // Sample size 2 < default minN of 3 → flag forced OK.
    expect(r.rows[0]?.flag).toBe('OK');
  });

  it('AWARDED-only by default', () => {
    const r = buildJobCoWinRate({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('a');
  });

  it('sorts lowest approval rate first', () => {
    const r = buildJobCoWinRate({
      jobs: [
        job({ id: 'high' }),
        job({ id: 'low' }),
      ],
      changeOrders: [
        co({ id: 'h1', jobId: 'high', status: 'APPROVED' }),
        co({ id: 'h2', jobId: 'high', status: 'APPROVED' }),
        co({ id: 'h3', jobId: 'high', status: 'APPROVED' }),
        co({ id: 'l1', jobId: 'low', status: 'APPROVED' }),
        co({ id: 'l2', jobId: 'low', status: 'REJECTED' }),
        co({ id: 'l3', jobId: 'low', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('low');
    expect(r.rows[1]?.jobId).toBe('high');
  });

  it('rolls up portfolio approval rate', () => {
    const r = buildJobCoWinRate({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a1', status: 'APPROVED' }),
        co({ id: 'a2', status: 'APPROVED' }),
        co({ id: 'r', status: 'REJECTED' }),
      ],
    });
    expect(r.rollup.totalProposed).toBe(3);
    expect(r.rollup.totalApproved).toBe(2);
    expect(r.rollup.blendedApprovalRate).toBeCloseTo(2 / 3, 4);
  });

  it('handles empty input', () => {
    const r = buildJobCoWinRate({ jobs: [], changeOrders: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalProposed).toBe(0);
  });
});
