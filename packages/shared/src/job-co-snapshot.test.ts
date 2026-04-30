import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildJobCoSnapshot } from './job-co-snapshot';

function co(over: Partial<ChangeOrder>): ChangeOrder {
  return {
    id: 'co-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    changeOrderNumber: '1',
    subject: 'Pavement repair',
    description: 'T',
    reason: 'OWNER_DIRECTED',
    status: 'PROPOSED',
    proposedAt: '2026-04-15',
    lineItems: [{ description: 'l', amountCents: 50_000_00 }],
    ...over,
  } as ChangeOrder;
}

describe('buildJobCoSnapshot', () => {
  it('filters to a single job', () => {
    const r = buildJobCoSnapshot({
      jobId: 'j1',
      changeOrders: [
        co({ id: 'a', jobId: 'j1' }),
        co({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalCos).toBe(1);
  });

  it('separates approved+executed amount from proposed', () => {
    const r = buildJobCoSnapshot({
      jobId: 'j1',
      changeOrders: [
        co({
          id: 'a',
          status: 'APPROVED',
          lineItems: [{ description: 'a', amountCents: 30_000_00 }],
        }),
        co({
          id: 'b',
          status: 'EXECUTED',
          lineItems: [{ description: 'b', amountCents: 20_000_00 }],
        }),
        co({
          id: 'c',
          status: 'PROPOSED',
          lineItems: [{ description: 'c', amountCents: 10_000_00 }],
        }),
      ],
    });
    expect(r.totalAmountCents).toBe(60_000_00);
    expect(r.approvedOrExecutedAmountCents).toBe(50_000_00);
    expect(r.proposedAmountCents).toBe(10_000_00);
  });

  it('counts by status + reason', () => {
    const r = buildJobCoSnapshot({
      jobId: 'j1',
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

  it('counts distinct subjects (case-insensitive)', () => {
    const r = buildJobCoSnapshot({
      jobId: 'j1',
      changeOrders: [
        co({ id: 'a', subject: 'Pavement repair' }),
        co({ id: 'b', subject: 'PAVEMENT REPAIR' }),
        co({ id: 'c', subject: 'Striping change' }),
      ],
    });
    expect(r.distinctSubjects).toBe(2);
  });

  it('handles no matching COs', () => {
    const r = buildJobCoSnapshot({ jobId: 'j1', changeOrders: [] });
    expect(r.totalCos).toBe(0);
  });
});
