import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildPortfolioPcoYoy } from './portfolio-pco-yoy';

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

describe('buildPortfolioPcoYoy', () => {
  it('compares prior vs current totals', () => {
    const r = buildPortfolioPcoYoy({
      currentYear: 2026,
      pcos: [
        pco({ id: 'a', noticedOn: '2025-04-15' }),
        pco({ id: 'b', noticedOn: '2026-04-15' }),
        pco({ id: 'c', noticedOn: '2026-05-15' }),
      ],
    });
    expect(r.priorTotal).toBe(1);
    expect(r.currentTotal).toBe(2);
    expect(r.totalDelta).toBe(1);
  });

  it('counts open vs converted', () => {
    const r = buildPortfolioPcoYoy({
      currentYear: 2026,
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'REJECTED' }),
      ],
    });
    expect(r.currentOpenCount).toBe(1);
    expect(r.currentConvertedCount).toBe(1);
  });

  it('sums total + open cost exposure (positive only)', () => {
    const r = buildPortfolioPcoYoy({
      currentYear: 2026,
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.currentOpenCostImpactCents).toBe(50_000_00);
    expect(r.currentTotalCostImpactCents).toBe(139_000_00);
  });

  it('sums schedule impact days + distinct jobs', () => {
    const r = buildPortfolioPcoYoy({
      currentYear: 2026,
      pcos: [
        pco({ id: 'a', jobId: 'j1', scheduleImpactDays: 5 }),
        pco({ id: 'b', jobId: 'j2', scheduleImpactDays: 10 }),
      ],
    });
    expect(r.currentTotalScheduleImpactDays).toBe(15);
    expect(r.currentDistinctJobs).toBe(2);
  });

  it('handles empty input', () => {
    const r = buildPortfolioPcoYoy({ currentYear: 2026, pcos: [] });
    expect(r.currentTotal).toBe(0);
  });
});
