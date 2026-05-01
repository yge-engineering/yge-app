import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoDetailSnapshot } from './job-pco-detail-snapshot';

function pc(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    pcoNumber: 'PCO-001',
    title: 'X',
    description: '',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-10',
    submittedOn: '2026-04-12',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildJobPcoDetailSnapshot', () => {
  it('returns one row per origin sorted by open cost', () => {
    const r = buildJobPcoDetailSnapshot({
      jobId: 'j1',
      asOf: '2026-04-30',
      pcos: [
        pc({ id: 'a', jobId: 'j1', origin: 'OWNER_DIRECTED', status: 'SUBMITTED', costImpactCents: 100_000_00 }),
        pc({ id: 'b', jobId: 'j1', origin: 'OWNER_DIRECTED', status: 'CONVERTED_TO_CO' }),
        pc({ id: 'c', jobId: 'j1', origin: 'UNFORESEEN_CONDITION', status: 'APPROVED_PENDING_CO', costImpactCents: 40_000_00 }),
        pc({ id: 'd', jobId: 'j2', origin: 'OWNER_DIRECTED', status: 'SUBMITTED' }),
      ],
    });
    expect(r.rows.length).toBe(2);
    expect(r.rows[0]?.origin).toBe('OWNER_DIRECTED');
    expect(r.rows[0]?.total).toBe(2);
    expect(r.rows[0]?.open).toBe(1);
    expect(r.rows[0]?.openCostCents).toBe(100_000_00);
    expect(r.rows[0]?.convertedToCo).toBe(1);
    expect(r.rows[1]?.origin).toBe('UNFORESEEN_CONDITION');
    expect(r.rows[1]?.approvedPendingCo).toBe(1);
    expect(r.rows[1]?.openCostCents).toBe(40_000_00);
  });

  it('handles unknown job', () => {
    const r = buildJobPcoDetailSnapshot({ jobId: 'X', pcos: [] });
    expect(r.rows.length).toBe(0);
  });
});
