import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildJobScheduleSlip } from './job-schedule-slip';

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
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildJobScheduleSlip', () => {
  it('flags NO_DATE when no original completion date supplied', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [],
      originalCompletionByJobId: new Map(),
    });
    expect(r.rows[0]?.flag).toBe('NO_DATE');
    expect(r.rows[0]?.revisedCompletionDate).toBe(null);
  });

  it('flags ON_TIME when revised completion is more than 14 days out', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [],
      originalCompletionByJobId: new Map([['job-1', '2026-06-30']]),
    });
    expect(r.rows[0]?.flag).toBe('ON_TIME');
  });

  it('flags AT_RISK when revised completion is within 14 days', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [],
      originalCompletionByJobId: new Map([['job-1', '2026-05-05']]),
    });
    expect(r.rows[0]?.flag).toBe('AT_RISK');
  });

  it('flags SLIPPING when 1-30 days past revised completion', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [],
      originalCompletionByJobId: new Map([['job-1', '2026-04-15']]),
    });
    expect(r.rows[0]?.flag).toBe('SLIPPING');
    expect(r.rows[0]?.daysToRevisedCompletion).toBe(-12);
  });

  it('flags SEVERE when 31+ days past revised completion', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [],
      originalCompletionByJobId: new Map([['job-1', '2026-02-01']]),
    });
    expect(r.rows[0]?.flag).toBe('SEVERE');
  });

  it('adds executed CO schedule days to original completion date', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', totalScheduleImpactDays: 10 }),
        co({ id: 'co-2', totalScheduleImpactDays: 20 }),
      ],
      originalCompletionByJobId: new Map([['job-1', '2026-06-01']]),
    });
    // 2026-06-01 + 30 days = 2026-07-01
    expect(r.rows[0]?.revisedCompletionDate).toBe('2026-07-01');
    expect(r.rows[0]?.netScheduleDaysAdded).toBe(30);
    expect(r.rows[0]?.scheduleAdjustingCoCount).toBe(2);
  });

  it('ignores non-EXECUTED COs', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [job({})],
      changeOrders: [
        co({ id: 'co-1', status: 'PROPOSED', totalScheduleImpactDays: 99 }),
        co({ id: 'co-2', status: 'AGENCY_REVIEW', totalScheduleImpactDays: 99 }),
        co({ id: 'co-3', status: 'EXECUTED', totalScheduleImpactDays: 5 }),
      ],
      originalCompletionByJobId: new Map([['job-1', '2026-06-01']]),
    });
    expect(r.rows[0]?.netScheduleDaysAdded).toBe(5);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awarded', status: 'AWARDED' }),
      ],
      changeOrders: [],
      originalCompletionByJobId: new Map([
        ['job-prosp', '2026-06-01'],
        ['job-awarded', '2026-06-01'],
      ]),
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.jobId).toBe('job-awarded');
  });

  it('includes all statuses when includeAllStatuses is true', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      includeAllStatuses: true,
      jobs: [
        job({ id: 'job-prosp', status: 'PROSPECT' }),
        job({ id: 'job-awarded', status: 'AWARDED' }),
      ],
      changeOrders: [],
      originalCompletionByJobId: new Map([
        ['job-prosp', '2026-06-01'],
        ['job-awarded', '2026-06-01'],
      ]),
    });
    expect(r.rows).toHaveLength(2);
  });

  it('rolls up tier counts and total schedule days added', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-on-time' }),
        job({ id: 'job-severe' }),
        job({ id: 'job-no-date' }),
      ],
      changeOrders: [
        co({ id: 'co-1', jobId: 'job-on-time', totalScheduleImpactDays: 7 }),
      ],
      originalCompletionByJobId: new Map([
        ['job-on-time', '2026-06-30'],
        ['job-severe', '2026-02-01'],
      ]),
    });
    expect(r.rollup.onTime).toBe(1);
    expect(r.rollup.severe).toBe(1);
    expect(r.rollup.noDate).toBe(1);
    expect(r.rollup.totalScheduleDaysAdded).toBe(7);
  });

  it('sorts SEVERE first, NO_DATE last', () => {
    const r = buildJobScheduleSlip({
      asOf: '2026-04-27',
      jobs: [
        job({ id: 'job-on' }),
        job({ id: 'job-severe' }),
        job({ id: 'job-nd' }),
      ],
      changeOrders: [],
      originalCompletionByJobId: new Map([
        ['job-on', '2026-06-30'],
        ['job-severe', '2026-02-01'],
      ]),
    });
    expect(r.rows[0]?.flag).toBe('SEVERE');
    expect(r.rows[r.rows.length - 1]?.flag).toBe('NO_DATE');
  });
});
