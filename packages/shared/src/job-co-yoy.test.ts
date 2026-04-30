import { describe, expect, it } from 'vitest';

import type { ChangeOrder } from './change-order';

import { buildJobCoYoy } from './job-co-yoy';

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

describe('buildJobCoYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobCoYoy({
      jobId: 'j1',
      currentYear: 2026,
      changeOrders: [
        co({ id: 'a', proposedAt: '2025-04-15', lineItems: [{ description: 'a', amountCents: 30_000_00 }] }),
        co({ id: 'b', proposedAt: '2026-04-15', lineItems: [{ description: 'b', amountCents: 50_000_00 }] }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.amountDelta).toBe(20_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobCoYoy({ jobId: 'X', currentYear: 2026, changeOrders: [] });
    expect(r.priorTotal).toBe(0);
  });
});
