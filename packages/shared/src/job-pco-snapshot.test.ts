import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildJobPcoSnapshot } from './job-pco-snapshot';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'p-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'j1',
    pcoNumber: '1',
    title: 'T',
    description: 'T',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-15',
    costImpactCents: 50_000_00,
    scheduleImpactDays: 5,
    ...over,
  } as Pco;
}

describe('buildJobPcoSnapshot', () => {
  it('filters to one job', () => {
    const r = buildJobPcoSnapshot({
      jobId: 'j1',
      pcos: [
        pco({ id: 'a', jobId: 'j1' }),
        pco({ id: 'b', jobId: 'j2' }),
      ],
    });
    expect(r.totalPcos).toBe(1);
  });

  it('counts open vs converted', () => {
    const r = buildJobPcoSnapshot({
      jobId: 'j1',
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'UNDER_REVIEW' }),
        pco({ id: 'c', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'd', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.openCount).toBe(2);
    expect(r.convertedCount).toBe(1);
  });

  it('sums open cost exposure (positive only, open only)', () => {
    const r = buildJobPcoSnapshot({
      jobId: 'j1',
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.openCostImpactCents).toBe(50_000_00);
    expect(r.totalCostImpactCents).toBe(149_000_00);
  });

  it('sums schedule impact days', () => {
    const r = buildJobPcoSnapshot({
      jobId: 'j1',
      pcos: [
        pco({ id: 'a', scheduleImpactDays: 5 }),
        pco({ id: 'b', scheduleImpactDays: 10 }),
      ],
    });
    expect(r.totalScheduleImpactDays).toBe(15);
  });

  it('handles no matching pcos', () => {
    const r = buildJobPcoSnapshot({ jobId: 'j1', pcos: [] });
    expect(r.totalPcos).toBe(0);
  });
});
