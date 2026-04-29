import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildPortfolioLienWaiverMonthly } from './portfolio-lien-waiver-monthly';

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

describe('buildPortfolioLienWaiverMonthly', () => {
  it('breaks down by kind', () => {
    const r = buildPortfolioLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', kind: 'CONDITIONAL_PROGRESS' }),
        lw({ id: 'b', kind: 'UNCONDITIONAL_PROGRESS' }),
        lw({ id: 'c', kind: 'CONDITIONAL_PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byKind.CONDITIONAL_PROGRESS).toBe(2);
    expect(r.rows[0]?.byKind.UNCONDITIONAL_PROGRESS).toBe(1);
  });

  it('counts signed / delivered / voided', () => {
    const r = buildPortfolioLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', status: 'DRAFT' }),
        lw({ id: 'b', status: 'SIGNED' }),
        lw({ id: 'c', status: 'DELIVERED' }),
        lw({ id: 'd', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.signedCount).toBe(2);
    expect(r.rows[0]?.deliveredCount).toBe(1);
    expect(r.rows[0]?.voidedCount).toBe(1);
  });

  it('sums paymentAmountCents', () => {
    const r = buildPortfolioLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', paymentAmountCents: 50_000_00 }),
        lw({ id: 'b', paymentAmountCents: 30_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(80_000_00);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1' }),
        lw({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioLienWaiverMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      lienWaivers: [
        lw({ id: 'old', throughDate: '2026-03-15' }),
        lw({ id: 'in', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalWaivers).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', throughDate: '2026-06-15' }),
        lw({ id: 'b', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioLienWaiverMonthly({ lienWaivers: [] });
    expect(r.rows).toHaveLength(0);
  });
});
