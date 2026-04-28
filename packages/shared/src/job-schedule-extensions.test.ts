import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildJobScheduleExtensions } from './job-schedule-extensions';

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
    status: 'PROPOSED',
    lineItems: [],
    totalCostImpactCents: 0,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildJobScheduleExtensions', () => {
  it('counts extension-bearing COs', () => {
    const r = buildJobScheduleExtensions({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', totalScheduleImpactDays: 5 }),
        co({ id: 'b', totalScheduleImpactDays: 10 }),
        co({ id: 'noop', totalScheduleImpactDays: 0 }),
      ],
    });
    expect(r.rows[0]?.withScheduleImpact).toBe(2);
  });

  it('separates proposed / approved / pending / rejected days', () => {
    const r = buildJobScheduleExtensions({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED', totalScheduleImpactDays: 5 }),
        co({ id: 'r', status: 'AGENCY_REVIEW', totalScheduleImpactDays: 7 }),
        co({ id: 'a', status: 'APPROVED', totalScheduleImpactDays: 10 }),
        co({ id: 'e', status: 'EXECUTED', totalScheduleImpactDays: 3 }),
        co({ id: 'rej', status: 'REJECTED', totalScheduleImpactDays: 4 }),
        co({ id: 'w', status: 'WITHDRAWN', totalScheduleImpactDays: 2 }),
      ],
    });
    const row = r.rows[0];
    // proposed = open + approved (not rejected)
    expect(row?.proposedDays).toBe(25); // 5 + 7 + 10 + 3
    expect(row?.approvedDays).toBe(13); // 10 + 3
    expect(row?.pendingDays).toBe(12);  // 5 + 7
    expect(row?.rejectedDays).toBe(4);
  });

  it('counts negative schedule days as acceleration', () => {
    const r = buildJobScheduleExtensions({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED', totalScheduleImpactDays: -5 }),
        co({ id: 'b', status: 'APPROVED', totalScheduleImpactDays: -3 }),
      ],
    });
    expect(r.rows[0]?.acceleratedDays).toBe(8);
    expect(r.rows[0]?.approvedDays).toBe(0);
  });

  it('AWARDED-only by default', () => {
    const r = buildJobScheduleExtensions({
      jobs: [
        job({ id: 'p', status: 'PROSPECT' }),
        job({ id: 'a' }),
      ],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts most-approved-days first', () => {
    const r = buildJobScheduleExtensions({
      jobs: [
        job({ id: 'small' }),
        job({ id: 'big' }),
      ],
      changeOrders: [
        co({ id: 's', jobId: 'small', status: 'APPROVED', totalScheduleImpactDays: 5 }),
        co({ id: 'b', jobId: 'big', status: 'APPROVED', totalScheduleImpactDays: 30 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('big');
  });

  it('rolls up portfolio totals', () => {
    const r = buildJobScheduleExtensions({
      jobs: [job({})],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED', totalScheduleImpactDays: 5 }),
        co({ id: 'p', status: 'PROPOSED', totalScheduleImpactDays: 7 }),
        co({ id: 'r', status: 'REJECTED', totalScheduleImpactDays: 3 }),
        co({ id: 'acc', status: 'APPROVED', totalScheduleImpactDays: -2 }),
      ],
    });
    expect(r.rollup.totalApprovedDays).toBe(5);
    expect(r.rollup.totalPendingDays).toBe(7);
    expect(r.rollup.totalRejectedDays).toBe(3);
    expect(r.rollup.totalAcceleratedDays).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildJobScheduleExtensions({ jobs: [], changeOrders: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalApprovedDays).toBe(0);
  });
});
