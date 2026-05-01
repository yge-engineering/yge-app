import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoByOrigin } from './job-pco-by-origin';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'Test',
    description: 'Test',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-15',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildJobPcoByOrigin', () => {
  it('groups by (job, origin)', () => {
    const r = buildJobPcoByOrigin({
      pcos: [
        pco({ id: 'a', jobId: 'j1', origin: 'OWNER_DIRECTED' }),
        pco({ id: 'b', jobId: 'j1', origin: 'UNFORESEEN_CONDITION' }),
        pco({ id: 'c', jobId: 'j2', origin: 'OWNER_DIRECTED' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts open + converted', () => {
    const r = buildJobPcoByOrigin({
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'UNDER_REVIEW' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(2);
    expect(r.rows[0]?.convertedCount).toBe(1);
  });

  it('sums cost only on open + positive', () => {
    const r = buildJobPcoByOrigin({
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCostImpactCents).toBe(50_000_00);
  });

  it('respects fromDate / toDate', () => {
    const r = buildJobPcoByOrigin({
      fromDate: '2026-04-01',
      toDate: '2026-04-30',
      pcos: [
        pco({ id: 'old', noticedOn: '2026-03-15' }),
        pco({ id: 'in', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPcos).toBe(1);
  });

  it('sorts by jobId asc, costImpact desc within job', () => {
    const r = buildJobPcoByOrigin({
      pcos: [
        pco({ id: 'a', jobId: 'A', origin: 'OWNER_DIRECTED', costImpactCents: 5_000_00 }),
        pco({ id: 'b', jobId: 'A', origin: 'UNFORESEEN_CONDITION', costImpactCents: 100_000_00 }),
      ],
    });
    expect(r.rows[0]?.origin).toBe('UNFORESEEN_CONDITION');
  });

  it('handles empty input', () => {
    const r = buildJobPcoByOrigin({ pcos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
