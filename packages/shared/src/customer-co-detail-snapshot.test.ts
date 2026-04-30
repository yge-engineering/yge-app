import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCustomerCoDetailSnapshot } from './customer-co-detail-snapshot';

function jb(id: string, owner: string): Job {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORKS',
    status: 'PURSUING',
    ownerAgency: owner,
  } as Job;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-10T00:00:00Z',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '01',
    subject: 'X',
    description: '',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-10',
    lineItems: [],
    totalCostImpactCents: 10_000_00,
    totalScheduleImpactDays: 5,
    ...over,
  } as ChangeOrder;
}

describe('buildCustomerCoDetailSnapshot', () => {
  it('returns one row per job sorted by cost impact', () => {
    const r = buildCustomerCoDetailSnapshot({
      customerName: 'Caltrans',
      asOf: '2026-04-30',
      jobs: [jb('j1', 'Caltrans'), jb('j2', 'Caltrans')],
      changeOrders: [
        co({ id: 'a', jobId: 'j1', status: 'EXECUTED', totalCostImpactCents: 100_000_00, totalScheduleImpactDays: 14 }),
        co({ id: 'b', jobId: 'j1', status: 'PROPOSED', totalCostImpactCents: 5_000_00 }),
        co({ id: 'c', jobId: 'j2', status: 'APPROVED', totalCostImpactCents: 25_000_00, totalScheduleImpactDays: 3 }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.jobId).toBe('j1');
    expect(r.rows[0]?.totalCos).toBe(2);
    expect(r.rows[0]?.executed).toBe(1);
    expect(r.rows[0]?.proposed).toBe(1);
    // Only EXECUTED on j1 contributes to cost (PROPOSED skipped)
    expect(r.rows[0]?.totalCostImpactCents).toBe(100_000_00);
    expect(r.rows[0]?.totalScheduleDays).toBe(14);
    expect(r.rows[1]?.jobId).toBe('j2');
    expect(r.rows[1]?.approved).toBe(1);
    expect(r.rows[1]?.totalCostImpactCents).toBe(25_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerCoDetailSnapshot({
      customerName: 'X',
      jobs: [],
      changeOrders: [],
    });
    expect(r.rows.length).toBe(0);
  });
});
