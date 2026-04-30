import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

import { buildCustomerCoYoy } from './customer-co-yoy';

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

describe('buildCustomerCoYoy', () => {
  it('compares two years for one customer', () => {
    const r = buildCustomerCoYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      changeOrders: [
        co({ id: 'a', proposedAt: '2025-04-15', lineItems: [{ description: 'a', amountCents: 30_000_00 }] }),
        co({ id: 'b', proposedAt: '2026-04-15', lineItems: [{ description: 'b', amountCents: 50_000_00 }] }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorTotalAmountCents).toBe(30_000_00);
    expect(r.currentTotalAmountCents).toBe(50_000_00);
    expect(r.totalAmountDelta).toBe(20_000_00);
  });

  it('separates approved+executed vs proposed', () => {
    const r = buildCustomerCoYoy({
      customerName: 'Caltrans',
      currentYear: 2026,
      jobs: [jb('j1', 'Caltrans')],
      changeOrders: [
        co({ id: 'a', status: 'APPROVED', lineItems: [{ description: 'a', amountCents: 30_000_00 }] }),
        co({ id: 'b', status: 'PROPOSED', lineItems: [{ description: 'b', amountCents: 10_000_00 }] }),
      ],
    });
    expect(r.currentApprovedOrExecutedCents).toBe(30_000_00);
    expect(r.currentProposedCents).toBe(10_000_00);
  });

  it('handles unknown customer', () => {
    const r = buildCustomerCoYoy({
      customerName: 'X',
      currentYear: 2026,
      jobs: [],
      changeOrders: [],
    });
    expect(r.priorTotal).toBe(0);
  });
});
