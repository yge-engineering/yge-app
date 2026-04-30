import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildPortfolioLienWaiverYoy } from './portfolio-lien-waiver-yoy';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'X',
    jobName: 'X',
    claimantName: 'YGE',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildPortfolioLienWaiverYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioLienWaiverYoy({
      currentYear: 2026,
      lienWaivers: [
        lw({ id: 'a', throughDate: '2025-04-15', paymentAmountCents: 50_000_00 }),
        lw({ id: 'b', throughDate: '2026-04-15', paymentAmountCents: 100_000_00 }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(1);
    expect(r.priorTotalAmountCents).toBe(50_000_00);
    expect(r.currentTotalAmountCents).toBe(100_000_00);
    expect(r.totalAmountCentsDelta).toBe(50_000_00);
  });

  it('breaks down by kind', () => {
    const r = buildPortfolioLienWaiverYoy({
      currentYear: 2026,
      lienWaivers: [
        lw({ id: 'a', kind: 'CONDITIONAL_PROGRESS' }),
        lw({ id: 'b', kind: 'UNCONDITIONAL_PROGRESS' }),
      ],
    });
    expect(r.currentByKind.CONDITIONAL_PROGRESS).toBe(1);
    expect(r.currentByKind.UNCONDITIONAL_PROGRESS).toBe(1);
  });

  it('counts signed / delivered / voided', () => {
    const r = buildPortfolioLienWaiverYoy({
      currentYear: 2026,
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED' }),
        lw({ id: 'b', status: 'DELIVERED' }),
        lw({ id: 'c', status: 'VOIDED' }),
      ],
    });
    expect(r.currentSignedCount).toBe(2);
    expect(r.currentDeliveredCount).toBe(1);
    expect(r.currentVoidedCount).toBe(1);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioLienWaiverYoy({
      currentYear: 2026,
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1' }),
        lw({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioLienWaiverYoy({ currentYear: 2026, lienWaivers: [] });
    expect(r.currentTotal).toBe(0);
  });
});
