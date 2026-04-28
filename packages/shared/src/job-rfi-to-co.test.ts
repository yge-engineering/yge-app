import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';
import type { Rfi } from './rfi';

import { buildJobRfiToCo } from './job-rfi-to-co';

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
    status: 'ANSWERED',
    sentAt: '2026-04-01',
    ...over,
  } as Rfi;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'job-1',
    changeOrderNumber: 'CO-01',
    subject: 'Curb revision',
    description: '',
    reason: 'RFI_RESPONSE',
    status: 'EXECUTED',
    proposedAt: '2026-04-15',
    lineItems: [],
    totalCostImpactCents: 25_000_00,
    totalScheduleImpactDays: 0,
    ...over,
  } as ChangeOrder;
}

describe('buildJobRfiToCo', () => {
  it('counts RFIs and conversions', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [rfi({ id: 'r1' }), rfi({ id: 'r2' })],
      changeOrders: [co({ originRfiId: 'r1' })],
    });
    expect(r.rows[0]?.rfiCount).toBe(2);
    expect(r.rows[0]?.rfiToCoCount).toBe(1);
    expect(r.rows[0]?.conversionRate).toBe(0.5);
  });

  it('skips COs without originRfiId', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [rfi({})],
      changeOrders: [co({ originRfiId: undefined })],
    });
    expect(r.rows[0]?.rfiToCoCount).toBe(0);
  });

  it('skips COs whose originRfiId points at a missing RFI', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [],
      changeOrders: [co({ originRfiId: 'gone' })],
    });
    expect(r.rows[0]?.rfiToCoCount).toBe(0);
  });

  it('sums |totalCostImpactCents| including deducts', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [rfi({ id: 'r1' }), rfi({ id: 'r2' })],
      changeOrders: [
        co({ id: 'c1', originRfiId: 'r1', totalCostImpactCents: 30_000_00 }),
        co({ id: 'c2', originRfiId: 'r2', totalCostImpactCents: -10_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalRfiDrivenCoCents).toBe(40_000_00);
  });

  it('computes avg days from RFI sentAt to CO proposedAt', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [
        rfi({ id: 'r1', sentAt: '2026-04-01' }),
        rfi({ id: 'r2', sentAt: '2026-04-10' }),
      ],
      changeOrders: [
        co({ id: 'c1', originRfiId: 'r1', proposedAt: '2026-04-15' }), // 14
        co({ id: 'c2', originRfiId: 'r2', proposedAt: '2026-04-20' }), // 10
      ],
    });
    expect(r.rows[0]?.avgDaysRfiToCo).toBe(12);
  });

  it('null avg when no matched pairs have dates', () => {
    const r = buildJobRfiToCo({
      jobs: [job({})],
      rfis: [rfi({ id: 'r1', sentAt: undefined })],
      changeOrders: [co({ originRfiId: 'r1', proposedAt: undefined })],
    });
    expect(r.rows[0]?.avgDaysRfiToCo).toBe(null);
  });

  it('skips non-AWARDED jobs by default', () => {
    const r = buildJobRfiToCo({
      jobs: [
        job({ id: 'j-prosp', status: 'PROSPECT' }),
        job({ id: 'j-awd' }),
      ],
      rfis: [],
      changeOrders: [],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('rolls up totals across jobs', () => {
    const r = buildJobRfiToCo({
      jobs: [job({ id: 'j1' }), job({ id: 'j2' })],
      rfis: [
        rfi({ id: 'r1', jobId: 'j1' }),
        rfi({ id: 'r2', jobId: 'j2' }),
      ],
      changeOrders: [
        co({ id: 'c1', jobId: 'j1', originRfiId: 'r1', totalCostImpactCents: 10_000_00 }),
        co({ id: 'c2', jobId: 'j2', originRfiId: 'r2', totalCostImpactCents: 20_000_00 }),
      ],
    });
    expect(r.rollup.totalRfis).toBe(2);
    expect(r.rollup.totalRfisConverted).toBe(2);
    expect(r.rollup.totalRfiDrivenCoCents).toBe(30_000_00);
  });

  it('sorts highest RFI-driven CO cents first', () => {
    const r = buildJobRfiToCo({
      jobs: [job({ id: 'j-low' }), job({ id: 'j-high' })],
      rfis: [
        rfi({ id: 'r1', jobId: 'j-low' }),
        rfi({ id: 'r2', jobId: 'j-high' }),
      ],
      changeOrders: [
        co({ id: 'c1', jobId: 'j-low', originRfiId: 'r1', totalCostImpactCents: 5_000_00 }),
        co({ id: 'c2', jobId: 'j-high', originRfiId: 'r2', totalCostImpactCents: 50_000_00 }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('j-high');
  });
});
