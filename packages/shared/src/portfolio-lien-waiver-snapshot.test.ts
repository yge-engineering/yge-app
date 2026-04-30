import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildPortfolioLienWaiverSnapshot } from './portfolio-lien-waiver-snapshot';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'Owner A',
    jobName: 'Job A',
    claimantName: 'Young General Engineering',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildPortfolioLienWaiverSnapshot', () => {
  it('counts waivers + ytd', () => {
    const r = buildPortfolioLienWaiverSnapshot({
      asOf: '2026-04-30',
      logYear: 2026,
      lienWaivers: [
        lw({ id: 'a', throughDate: '2025-04-15' }),
        lw({ id: 'b', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.totalWaivers).toBe(2);
    expect(r.ytdWaivers).toBe(1);
  });

  it('breaks down by kind + status', () => {
    const r = buildPortfolioLienWaiverSnapshot({
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', kind: 'CONDITIONAL_PROGRESS', status: 'SIGNED' }),
        lw({ id: 'b', kind: 'UNCONDITIONAL_PROGRESS', status: 'DELIVERED' }),
        lw({ id: 'c', kind: 'CONDITIONAL_FINAL', status: 'DRAFT' }),
        lw({ id: 'd', kind: 'UNCONDITIONAL_FINAL', status: 'VOIDED' }),
      ],
    });
    expect(r.byKind.CONDITIONAL_PROGRESS).toBe(1);
    expect(r.byKind.UNCONDITIONAL_FINAL).toBe(1);
    expect(r.signedWaivers).toBe(1);
    expect(r.deliveredWaivers).toBe(1);
    expect(r.draftWaivers).toBe(1);
    expect(r.voidedWaivers).toBe(1);
  });

  it('sums payment amounts excluding voided', () => {
    const r = buildPortfolioLienWaiverSnapshot({
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED', paymentAmountCents: 50_000_00, disputedAmountCents: 5_000_00 }),
        lw({ id: 'b', status: 'DELIVERED', paymentAmountCents: 30_000_00 }),
        lw({ id: 'c', status: 'VOIDED', paymentAmountCents: 99_999_00 }),
      ],
    });
    expect(r.totalPaymentAmountCents).toBe(80_000_00);
    expect(r.totalDisputedAmountCents).toBe(5_000_00);
  });

  it('counts distinct jobs + owners', () => {
    const r = buildPortfolioLienWaiverSnapshot({
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1', ownerName: 'A' }),
        lw({ id: 'b', jobId: 'j2', ownerName: 'B' }),
      ],
    });
    expect(r.distinctJobs).toBe(2);
    expect(r.distinctOwners).toBe(2);
  });

  it('ignores waivers with throughDate after asOf', () => {
    const r = buildPortfolioLienWaiverSnapshot({
      asOf: '2026-04-30',
      lienWaivers: [lw({ id: 'late', throughDate: '2026-05-15' })],
    });
    expect(r.totalWaivers).toBe(0);
  });

  it('handles empty input', () => {
    const r = buildPortfolioLienWaiverSnapshot({ lienWaivers: [] });
    expect(r.totalWaivers).toBe(0);
  });
});
