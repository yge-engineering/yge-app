import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildLienWaiverMonthly } from './lien-waiver-monthly';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'DELIVERED',
    ownerName: 'CAL FIRE',
    jobName: 'Sulphur Springs',
    claimantName: 'YGE',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildLienWaiverMonthly', () => {
  it('buckets by yyyy-mm of throughDate', () => {
    const r = buildLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', throughDate: '2026-03-15' }),
        lw({ id: 'b', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(2);
  });

  it('counts each Civil Code kind separately', () => {
    const r = buildLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', kind: 'CONDITIONAL_PROGRESS' }),
        lw({ id: 'b', kind: 'UNCONDITIONAL_PROGRESS' }),
        lw({ id: 'c', kind: 'CONDITIONAL_FINAL' }),
        lw({ id: 'd', kind: 'UNCONDITIONAL_FINAL' }),
      ],
    });
    expect(r.rows[0]?.conditionalProgress).toBe(1);
    expect(r.rows[0]?.unconditionalProgress).toBe(1);
    expect(r.rows[0]?.conditionalFinal).toBe(1);
    expect(r.rows[0]?.unconditionalFinal).toBe(1);
  });

  it('counts signed and delivered (delivered also counts as signed)', () => {
    const r = buildLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', status: 'SIGNED' }),
        lw({ id: 'b', status: 'DELIVERED' }),
        lw({ id: 'c', status: 'DRAFT' }),
        lw({ id: 'd', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.signedCount).toBe(2);
    expect(r.rows[0]?.deliveredCount).toBe(1);
    expect(r.rows[0]?.voidedCount).toBe(1);
  });

  it('sums paymentAmountCents and counts distinct jobs', () => {
    const r = buildLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1', paymentAmountCents: 30_000_00 }),
        lw({ id: 'b', jobId: 'j2', paymentAmountCents: 20_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(50_000_00);
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth bounds', () => {
    const r = buildLienWaiverMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      lienWaivers: [
        lw({ id: 'mar', throughDate: '2026-03-15' }),
        lw({ id: 'apr', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(1);
  });

  it('sorts by month asc', () => {
    const r = buildLienWaiverMonthly({
      lienWaivers: [
        lw({ id: 'late', throughDate: '2026-04-15' }),
        lw({ id: 'early', throughDate: '2026-02-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-02');
  });

  it('handles empty input', () => {
    const r = buildLienWaiverMonthly({ lienWaivers: [] });
    expect(r.rows).toHaveLength(0);
  });
});
