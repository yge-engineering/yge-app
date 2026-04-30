import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildPortfolioPcoSnapshot } from './portfolio-pco-snapshot';

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

describe('buildPortfolioPcoSnapshot', () => {
  it('counts by status', () => {
    const r = buildPortfolioPcoSnapshot({
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'REJECTED' }),
      ],
    });
    expect(r.byStatus.SUBMITTED).toBe(1);
    expect(r.byStatus.CONVERTED_TO_CO).toBe(1);
    expect(r.byStatus.REJECTED).toBe(1);
  });

  it('counts open vs converted', () => {
    const r = buildPortfolioPcoSnapshot({
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

  it('sums total + open cost exposure (positive only)', () => {
    const r = buildPortfolioPcoSnapshot({
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.openCostImpactCents).toBe(50_000_00);
    expect(r.totalCostImpactCents).toBe(139_000_00);
  });

  it('sums schedule impact + distinct jobs', () => {
    const r = buildPortfolioPcoSnapshot({
      pcos: [
        pco({ id: 'a', jobId: 'j1', scheduleImpactDays: 5 }),
        pco({ id: 'b', jobId: 'j2', scheduleImpactDays: 10 }),
      ],
    });
    expect(r.totalScheduleImpactDays).toBe(15);
    expect(r.distinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPcoSnapshot({ pcos: [] });
    expect(r.totalPcos).toBe(0);
  });
});
