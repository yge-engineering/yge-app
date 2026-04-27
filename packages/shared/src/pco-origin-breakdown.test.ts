import { describe, expect, it } from 'vitest';
import { buildPcoOriginBreakdown } from './pco-origin-breakdown';
import type { Pco } from './pco';

function pco(over: Partial<Pco>): Pco {
  return {
    id: 'pco-1',
    createdAt: '',
    updatedAt: '',
    jobId: 'job-1',
    pcoNumber: 'PCO-001',
    title: 'Extra rebar',
    description: 'something',
    origin: 'OWNER_DIRECTED',
    status: 'SUBMITTED',
    noticedOn: '2026-04-01',
    costImpactCents: 100_00,
    scheduleImpactDays: 0,
    ...over,
  } as Pco;
}

describe('buildPcoOriginBreakdown', () => {
  it('groups by origin', () => {
    const r = buildPcoOriginBreakdown({
      pcos: [
        pco({ id: '1', origin: 'OWNER_DIRECTED', costImpactCents: 100_00 }),
        pco({ id: '2', origin: 'OWNER_DIRECTED', costImpactCents: 200_00 }),
        pco({ id: '3', origin: 'DESIGN_CHANGE', costImpactCents: 50_00 }),
      ],
    });
    const owner = r.rows.find((x) => x.origin === 'OWNER_DIRECTED')!;
    expect(owner.count).toBe(2);
    expect(owner.totalCostImpactCents).toBe(300_00);
  });

  it('skips WITHDRAWN by default', () => {
    const r = buildPcoOriginBreakdown({
      pcos: [
        pco({ id: '1', status: 'SUBMITTED' }),
        pco({ id: '2', status: 'WITHDRAWN' }),
      ],
    });
    expect(r.totalPcos).toBe(1);
  });

  it('includeWithdrawn keeps them', () => {
    const r = buildPcoOriginBreakdown({
      pcos: [
        pco({ id: '1', status: 'SUBMITTED' }),
        pco({ id: '2', status: 'WITHDRAWN' }),
      ],
      includeWithdrawn: true,
    });
    expect(r.totalPcos).toBe(2);
  });

  it('honors date range on noticedOn', () => {
    const r = buildPcoOriginBreakdown({
      start: '2026-04-01',
      end: '2026-04-30',
      pcos: [
        pco({ id: 'in', noticedOn: '2026-04-15' }),
        pco({ id: 'before', noticedOn: '2026-03-15' }),
        pco({ id: 'after', noticedOn: '2026-05-15' }),
      ],
    });
    expect(r.totalPcos).toBe(1);
  });

  it('share calculations', () => {
    const r = buildPcoOriginBreakdown({
      pcos: [
        pco({ id: '1', origin: 'OWNER_DIRECTED', costImpactCents: 800_00 }),
        pco({ id: '2', origin: 'DESIGN_CHANGE', costImpactCents: 200_00 }),
      ],
    });
    const owner = r.rows.find((x) => x.origin === 'OWNER_DIRECTED')!;
    expect(owner.shareOfCount).toBe(0.5);
    expect(owner.shareOfDollars).toBeCloseTo(0.8, 4);
  });

  it('sorts highest dollar impact first', () => {
    const r = buildPcoOriginBreakdown({
      pcos: [
        pco({ id: '1', origin: 'OTHER', costImpactCents: 100_00 }),
        pco({ id: '2', origin: 'DESIGN_CHANGE', costImpactCents: 500_00 }),
        pco({ id: '3', origin: 'WEATHER_DELAY', costImpactCents: 250_00 }),
      ],
    });
    expect(r.rows.map((x) => x.origin)).toEqual([
      'DESIGN_CHANGE',
      'WEATHER_DELAY',
      'OTHER',
    ]);
  });

  it('handles empty input', () => {
    const r = buildPcoOriginBreakdown({ pcos: [] });
    expect(r.totalPcos).toBe(0);
    expect(r.rows).toHaveLength(0);
  });
});
