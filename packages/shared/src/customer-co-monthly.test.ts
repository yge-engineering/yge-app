import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCustomerCoMonthly } from './customer-co-monthly';

function job(over: Partial<Job>): Job {
  return {
    id: 'j1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    projectName: 'Test',
    projectType: 'ROAD_RECONSTRUCTION',
    contractType: 'PUBLIC',
    status: 'AWARDED',
    ownerAgency: 'Caltrans D2',
    ...over,
  } as Job;
}

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'Test',
    description: 'Test',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [
      { description: 'extra haul', amountCents: 50_000_00 },
    ],
    ...over,
  } as ChangeOrder;
}

describe('buildCustomerCoMonthly', () => {
  it('groups by (customer, month)', () => {
    const r = buildCustomerCoMonthly({
      jobs: [
        job({ id: 'j1', ownerAgency: 'Caltrans D2' }),
        job({ id: 'j2', ownerAgency: 'CAL FIRE' }),
      ],
      changeOrders: [
        co({ id: 'a', jobId: 'j1', proposedAt: '2026-04-15' }),
        co({ id: 'b', jobId: 'j2', proposedAt: '2026-04-15' }),
        co({ id: 'c', jobId: 'j1', proposedAt: '2026-05-01' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts approved + executed milestones', () => {
    const r = buildCustomerCoMonthly({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'a', proposedAt: '2026-04-15', approvedAt: '2026-04-20', executedAt: '2026-04-25' }),
        co({ id: 'b', proposedAt: '2026-04-16' }),
      ],
    });
    expect(r.rows[0]?.proposedCount).toBe(2);
    expect(r.rows[0]?.approvedCount).toBe(1);
    expect(r.rows[0]?.executedCount).toBe(1);
  });

  it('sums lineItems amountCents', () => {
    const r = buildCustomerCoMonthly({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({
          id: 'a',
          lineItems: [
            { description: 'a', amountCents: 30_000_00 },
            { description: 'b', amountCents: 20_000_00 },
          ],
        }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
  });

  it('breaks down by reason', () => {
    const r = buildCustomerCoMonthly({
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'a', reason: 'OWNER_DIRECTED' }),
        co({ id: 'b', reason: 'DIFFERING_SITE_CONDITION' }),
        co({ id: 'c', reason: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows[0]?.byReason.OWNER_DIRECTED).toBe(2);
    expect(r.rows[0]?.byReason.DIFFERING_SITE_CONDITION).toBe(1);
  });

  it('counts unattributed (no proposedAt or no matching job)', () => {
    const r = buildCustomerCoMonthly({
      jobs: [job({ id: 'j1', ownerAgency: 'Caltrans D2' })],
      changeOrders: [
        co({ id: 'a', proposedAt: undefined }),
        co({ id: 'b', jobId: 'orphan' }),
        co({ id: 'c' }),
      ],
    });
    expect(r.rollup.unattributed).toBe(2);
    expect(r.rows).toHaveLength(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildCustomerCoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      jobs: [job({ id: 'j1' })],
      changeOrders: [
        co({ id: 'old', proposedAt: '2026-03-15' }),
        co({ id: 'in', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalCos).toBe(1);
  });

  it('sorts by customerName asc, month asc', () => {
    const r = buildCustomerCoMonthly({
      jobs: [
        job({ id: 'jA', ownerAgency: 'A Agency' }),
        job({ id: 'jZ', ownerAgency: 'Z Agency' }),
      ],
      changeOrders: [
        co({ id: 'a', jobId: 'jZ', proposedAt: '2026-04-15' }),
        co({ id: 'b', jobId: 'jA', proposedAt: '2026-05-01' }),
        co({ id: 'c', jobId: 'jA', proposedAt: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.customerName).toBe('A Agency');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.customerName).toBe('Z Agency');
  });

  it('handles empty input', () => {
    const r = buildCustomerCoMonthly({ jobs: [], changeOrders: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalCos).toBe(0);
  });
});
