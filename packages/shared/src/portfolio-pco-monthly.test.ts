import { describe, expect, it } from 'vitest';

import type { Pco } from './pco';

import { buildPortfolioPcoMonthly } from './portfolio-pco-monthly';

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

describe('buildPortfolioPcoMonthly', () => {
  it('counts open vs converted', () => {
    const r = buildPortfolioPcoMonthly({
      pcos: [
        pco({ id: 'a', status: 'SUBMITTED' }),
        pco({ id: 'b', status: 'CONVERTED_TO_CO' }),
        pco({ id: 'c', status: 'REJECTED' }),
      ],
    });
    expect(r.rows[0]?.openCount).toBe(1);
    expect(r.rows[0]?.convertedCount).toBe(1);
  });

  it('open cost exposure is positive open only', () => {
    const r = buildPortfolioPcoMonthly({
      pcos: [
        pco({ id: 'open-pos', status: 'SUBMITTED', costImpactCents: 50_000_00 }),
        pco({ id: 'open-neg', status: 'SUBMITTED', costImpactCents: -10_000_00 }),
        pco({ id: 'closed', status: 'CONVERTED_TO_CO', costImpactCents: 99_000_00 }),
      ],
    });
    expect(r.rows[0]?.openCostImpactCents).toBe(50_000_00);
    expect(r.rows[0]?.totalCostImpactCents).toBe(139_000_00);
  });

  it('sums schedule impact days', () => {
    const r = buildPortfolioPcoMonthly({
      pcos: [
        pco({ id: 'a', scheduleImpactDays: 5 }),
        pco({ id: 'b', scheduleImpactDays: 10 }),
      ],
    });
    expect(r.rows[0]?.totalScheduleImpactDays).toBe(15);
  });

  it('counts distinct jobs', () => {
    const r = buildPortfolioPcoMonthly({
      pcos: [
        pco({ id: 'a', jobId: 'j1' }),
        pco({ id: 'b', jobId: 'j2' }),
        pco({ id: 'c', jobId: 'j1' }),
      ],
    });
    expect(r.rows[0]?.distinctJobs).toBe(2);
  });

  it('respects fromMonth / toMonth', () => {
    const r = buildPortfolioPcoMonthly({
      fromMonth: '2026-04',
      toMonth: '2026-04',
      pcos: [
        pco({ id: 'old', noticedOn: '2026-03-15' }),
        pco({ id: 'in', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rollup.totalPcos).toBe(1);
  });

  it('sorts by month asc', () => {
    const r = buildPortfolioPcoMonthly({
      pcos: [
        pco({ id: 'a', noticedOn: '2026-06-15' }),
        pco({ id: 'b', noticedOn: '2026-04-15' }),
      ],
    });
    expect(r.rows[0]?.month).toBe('2026-04');
    expect(r.rows[1]?.month).toBe('2026-06');
  });

  it('handles empty input', () => {
    const r = buildPortfolioPcoMonthly({ pcos: [] });
    expect(r.rows).toHaveLength(0);
  });
});
