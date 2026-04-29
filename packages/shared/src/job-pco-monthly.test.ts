import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoMonthly } from './job-pco-monthly';

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

describe('buildJobPcoMonthly', () => {
  it('groups by (job, month)', () => {
    const r = buildJobPcoMonthly({
      pcos: [
        pco({ id: 'a', jobId: 'j1', noticedOn: '2026-03-15' }),
        pco({ id: 'b', jobId: 'j1', noticedOn: '2026-04-15' }),
        pco({ id: 'c', jobId: 'j2', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows).toHaveLength(3);
  });

  it('counts open / converted / rejected', () => {
    const r = buildJobPcoMonthly({
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'REJECTED' }),
        pco({ id: 'd', status: 'UNDER_REVIEW' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(2);
    expect(r.rows[0]?.convertedCount).toBe(1);
    expect(r.rows[0]?.rejectedCount).toBe(1);
  });

  it('sums cost impact only on open + positive', () => {
    const r = buildJobPcoMonthly({
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed-pos', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.totalCostImpactCents).toBe(50_000_00);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildJobPcoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      pcos: [
        pco({ id: 'mar', noticedOn: '2026-03-15' }),
        pco({ id: 'apr', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPcos).toBe(1);
  });

  it('sorts by jobId asc, month asc', () => {
    const r = buildJobPcoMonthly({
      pcos: [
        pco({ id: 'a', jobId: 'Z', noticedOn: '2026-04-15' }),
        pco({ id: 'b', jobId: 'A', noticedOn: '2026-03-15' }),
      ],
    });
    expect(r.rows[0]?.jobId).toBe('A');
  });

  it('handles empty input', () => {
    const r = buildJobPcoMonthly({ pcos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
