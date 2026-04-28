import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCustomerCoSummary } from './customer-co-summary';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC_WORKS',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'Extra base',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'EXECUTED',
    executedAt: '2026-04-15',
    lineItems: [],
    totalCostImpactCents: 50_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildCustomerCoSummary', () => {
  it('groups COs by job ownerAgency (canonicalized)', () => {
    const r = buildCustomerCoSummary({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'Caltrans, D2' }),
      ],
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]?.executedCount).toBe(2);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('only counts APPROVED + EXECUTED status', () => {
    const r = buildCustomerCoSummary({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'p', status: 'PROPOSED' }),
        co({ id: 'a', status: 'APPROVED' }),
        co({ id: 'e', status: 'EXECUTED' }),
        co({ id: 'r', status: 'REJECTED' }),
      ],
    });
    expect(r.rollup.executedCount).toBe(2);
  });

  it('splits adds vs deducts (signed math)', () => {
    const r = buildCustomerCoSummary({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'add', totalCostImpactCents: 100_000_00 }),
        co({ id: 'deduct', totalCostImpactCents: -30_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAddsCents).toBe(100_000_00);
    expect(r.rows[0]?.totalDeductsCents).toBe(30_000_00);
    expect(r.rows[0]?.totalCostImpactCents).toBe(70_000_00);
  });

  it('sums schedule impact days', () => {
    const r = buildCustomerCoSummary({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'a', totalScheduleImpactDays: 5 }),
        co({ id: 'b', totalScheduleImpactDays: 7 }),
      ],
    });
    expect(r.rows[0]?.totalScheduleImpactDays).toBe(12);
  });

  it('counts unattributed COs (no matching job) on rollup', () => {
    const r = buildCustomerCoSummary({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'good', jobId: 'j1' }),
        co({ id: 'orphan', jobId: 'j-missing' }),
      ],
    });
    expect(r.rollup.executedCount).toBe(2);
    expect(r.rollup.unattributed).toBe(1);
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by totalCostImpactCents desc', () => {
    const r = buildCustomerCoSummary({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Big' }),
        job({ id: 'j2', ownerAgency: 'Small' }),
      ],
      changeOrders: [
        co({ id: 'big', jobId: 'j1', totalCostImpactCents: 100_000_00 }),
        co({ id: 'sm', jobId: 'j2', totalCostImpactCents: 5_000_00 }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('Big');
  });

  it('respects fromDate / toDate window on executedAt', () => {
    const r = buildCustomerCoSummary({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'old', executedAt: '2026-03-15' }),
        co({ id: 'in', executedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.executedCount).toBe(1);
  });

  it('handles empty input', () => {
    const r = buildCustomerCoSummary({ jobs: [], changeOrders: [] });
    expect(r.rows).toHaveLength(0);
  });
});
