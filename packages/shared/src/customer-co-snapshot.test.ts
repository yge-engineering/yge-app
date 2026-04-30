import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCustomerCoSnapshot } from './customer-co-snapshot';

function jb(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '',
    updatedAt: '',
    projectName: 'T',
    projectType: 'BRIDGE',
    contractType: 'PUBLIC_WORK_LUMP_SUM',
    status: 'PURSUING',
    ownerAgency: 'Caltrans',
    ...over,
  } as Job;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'X',
    description: 'X',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [{ description: 'a', amountCents: 50_000_00 }],
    ...over,
  } as ChangeOrder;
}

describe('buildCustomerCoSnapshot', () => {
  it('joins COs to a customer via job.ownerAgency', () => {
    const r = buildCustomerCoSnapshot({
      customerName: 'Caltrans',
      jobs: [
        jb({ id: 'j1', ownerAgency: 'Caltrans' }),
        jb({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalCos).toBe(1);
    expect(r.distinctJobs).toBe(1);
  });

  it('separates approved+executed amount from proposed', () => {
    const r = buildCustomerCoSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' })],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED', lineItems: [{ description: 'a', amountCents: 30_000_00 }] }),
        co({ id: 'b', status: 'EXECUTED', lineItems: [{ description: 'b', amountCents: 20_000_00 }] }),
        co({ id: 'c', status: 'PROPOSED', lineItems: [{ description: 'c', amountCents: 10_000_00 }] }),
      ],
    });
    expect(r.totalAmountCents).toBe(60_000_00);
    expect(r.approvedOrExecutedAmountCents).toBe(50_000_00);
    expect(r.proposedAmountCents).toBe(10_000_00);
  });

  it('breaks down by status + reason', () => {
    const r = buildCustomerCoSnapshot({
      customerName: 'Caltrans',
      jobs: [jb({ id: 'j1' })],
      changeOrders: [
        co({ id: 'a', status: 'PROPOSED', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', status: 'EXECUTED', reason: 'DIFFERING_SITE_CONDITION' }),
      ],
    });
    expect(r.byStatus.PROPOSED).toBe(1);
    expect(r.byStatus.EXECUTED).toBe(1);
    expect(r.byReason.OWNER_DIRECTED).toBe(1);
    expect(r.byReason.DIFFERING_SITE_CONDITION).toBe(1);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerCoSnapshot({
      customerName: 'NonExistent',
      jobs: [],
      changeOrders: [],
    });
    expect(r.totalCos).toBe(0);
  });
});
