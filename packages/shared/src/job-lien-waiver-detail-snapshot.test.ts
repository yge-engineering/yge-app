import { describe, expect, it } from 'vitest';

import type { LienWaiver } from './lien-waiver';

import { buildJobLienWaiverDetailSnapshot } from './job-lien-waiver-detail-snapshot';

function lw(over: Partial<LienWaiver>): LienWaiver {
  return {
    id: 'lw-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    kind: 'CONDITIONAL_PROGRESS',
    status: 'SIGNED',
    ownerName: 'Caltrans',
    jobName: 'X',
    claimantName: 'YGE',
    paymentAmountCents: 50_000_00,
    throughDate: '2026-04-15',
    ...over,
  } as LienWaiver;
}

describe('buildJobLienWaiverDetailSnapshot', () => {
  it('returns one row per kind sorted by total waived', () => {
    const r = buildJobLienWaiverDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      lienWaivers: [
        lw({ id: 'a', jobId: 'j1', kind: 'UNCONDITIONAL_PROGRESS', status: 'DELIVERED', paymentAmountCents: 100_000_00 }),
        lw({ id: 'b', jobId: 'j1', kind: 'UNCONDITIONAL_PROGRESS', status: 'SIGNED', paymentAmountCents: 25_000_00 }),
        lw({ id: 'c', jobId: 'j1', kind: 'CONDITIONAL_FINAL', status: 'DRAFT', paymentAmountCents: 50_000_00 }),
        lw({ id: 'd', jobId: 'j2', kind: 'UNCONDITIONAL_PROGRESS', status: 'DELIVERED' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.kind).toBe('UNCONDITIONAL_PROGRESS');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.delivered).toBe(1);
    expect(r.rows[0]?.signed).toBe(1);
    expect(r.rows[0]?.totalWaivedCents).toBe(125_000_00);
    expect(r.rows[1]?.kind).toBe('CONDITIONAL_FINAL');
    expect(r.rows[1]?.draft).toBe(1);
    expect(r.rows[1]?.totalWaivedCents).toBe(0);
  });

  it('handles unknown job', () => {
    const r = buildJobLienWaiverDetailSnapshot({ jobId: 'X', lienWaivers: [] });
    expect(r.rows.length).toBe(0);
  });
});
