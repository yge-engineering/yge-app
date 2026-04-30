import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildJobLienWaiverYoy } from './job-lien-waiver-yoy';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'Caltrans',
    jobName: 'Job A',
    claimantName: 'YGE',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildJobLienWaiverYoy', () => {
  it('compares two years for one job', () => {
    const r = buildJobLienWaiverYoy({
      jobId: 'j1',
      currentYear: 2026,
      lienWaivers: [
        lw({ id: 'a', throughDate: '2025-04-15', paymentAmountCents: 50_000_00 }),
        lw({ id: 'b', throughDate: '2026-04-15', paymentAmountCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.paymentDelta).toBe(50_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobLienWaiverYoy({ jobId: 'X', currentYear: 2026, lienWaivers: [] });
    expect(r.priorTotal).toBe(0);
  });
});
