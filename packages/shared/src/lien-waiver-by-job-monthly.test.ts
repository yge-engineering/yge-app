import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildLienWaiverByJobMonthly } from './lien-waiver-by-job-monthly';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '2026-04-15T00:00:00.000Z',
    updatedAt: '2026-04-15T00:00:00.000Z',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'CAL FIRE',
    jobName: 'Sulphur Springs',
    claimantName: 'Young General Engineering',
    paymentAmountCents: 100_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildLienWaiverByJobMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildLienWaiverByJobMonthly({
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1', throughDate: '2026-04-15' }),
        lw({ id: 'b', jobId: 'j1', throughDate: '2026-05-01' }),
        lw({ id: 'c', jobId: 'j2', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('sums paymentAmountCents per (job, month)', () => {
    const r = buildLienWaiverByJobMonthly({
      lienWaivers: [
        lw({ id: 'a', paymentAmountCents: 30_000_00 }),
        lw({ id: 'b', paymentAmountCents: 70_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalAmountCents).toBe(100_000_00);
  });

  it('breaks down by kind', () => {
    const r = buildLienWaiverByJobMonthly({
      lienWaivers: [
        lw({ id: 'a', kind: 'CONDITIONAL_PROGRESS' }),
        lw({ id: 'b', kind: 'UNCONDITIONAL_PROGRESS' }),
        lw({ id: 'c', kind: 'CONDITIONAL_PROGRESS' }),
      ],
    });
    expect(r.rows[0]?.byKind.CONDITIONAL_PROGRESS).toBe(2);
    expect(r.rows[0]?.byKind.UNCONDITIONAL_PROGRESS).toBe(1);
  });

  it('counts signed / delivered / voided correctly', () => {
    const r = buildLienWaiverByJobMonthly({
      lienWaivers: [
        lw({ id: 'a', status: 'DRAFT' }),
        lw({ id: 'b', status: 'SIGNED' }),
        lw({ id: 'c', status: 'DELIVERED' }),
        lw({ id: 'd', status: 'VOIDED' }),
      ],
    });
    expect(r.rows[0]?.signedCount).toBe(2); // SIGNED + DELIVERED
    expect(r.rows[0]?.deliveredCount).toBe(1);
    expect(r.rows[0]?.voidedCount).toBe(1);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildLienWaiverByJobMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      lienWaivers: [
        lw({ id: 'old', throughDate: '2026-03-15' }),
        lw({ id: 'in', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalWaivers).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildLienWaiverByJobMonthly({
      lienWaivers: [
        lw({ id: 'a', jobId: 'Z', throughDate: '2026-04-15' }),
        lw({ id: 'b', jobId: 'A', throughDate: '2026-05-01' }),
        lw({ id: 'c', jobId: 'A', throughDate: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[2]?.jobId).toBe('Z');
  });

  it('handles empty input', () => {
    const r = buildLienWaiverByJobMonthly({ lienWaivers: [] });
    expect(r.rows).toHaveLength(0);
    expect(r.rollup.totalWaivers).toBe(0);
  });
});
