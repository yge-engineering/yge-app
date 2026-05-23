import { describe, it, expect } from 'vitest';
import {
  FixedAssetSchema,
  FixedAssetCreateSchema,
  FixedAssetPatchSchema,
  computeDepreciationSchedule,
  depreciationForYear,
  fixedAssetCategoryLabel,
  newFixedAssetId,
} from './fixed-asset';

const base = (over: Record<string, unknown> = {}) =>
  FixedAssetSchema.parse({
    id: 'fa-12345678',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    name: 'Cat 320 Excavator',
    category: 'HEAVY_EQUIPMENT',
    acquiredCostCents: 25_000_000, // $250k
    salvageValueCents: 5_000_000, // $50k
    acquiredOn: '2026-03-15',
    placedInServiceOn: '2026-03-15',
    usefulLifeYears: 5,
    method: 'STRAIGHT_LINE',
    bonusPercentage: 0.6,
    ...over,
  });

describe('FixedAssetSchema', () => {
  it('parses with defaults', () => {
    const a = base();
    expect(a.category).toBe('HEAVY_EQUIPMENT');
    expect(a.usefulLifeYears).toBe(5);
  });
  it('rejects bad date', () => {
    expect(
      FixedAssetSchema.safeParse({
        ...base(),
        acquiredOn: '3/15/2026',
      }).success,
    ).toBe(false);
  });
});

describe('FixedAssetCreate/Patch', () => {
  it('Create omits id/timestamps', () => {
    const c = FixedAssetCreateSchema.parse({
      name: 'Truck',
      category: 'VEHICLE',
      acquiredCostCents: 4_000_000,
      acquiredOn: '2026-01-01',
      placedInServiceOn: '2026-01-01',
      method: 'MACRS_5YR',
    });
    expect(c.name).toBe('Truck');
  });
  it('Patch accepts empty', () => {
    expect(FixedAssetPatchSchema.safeParse({}).success).toBe(true);
  });
});

describe('computeDepreciationSchedule — STRAIGHT_LINE', () => {
  it('$200k over 5 years salvage $0 → $40k/yr', () => {
    const sched = computeDepreciationSchedule({
      acquiredCostCents: 20_000_000,
      salvageValueCents: 0,
      usefulLifeYears: 5,
      method: 'STRAIGHT_LINE',
      bonusPercentage: 0,
    });
    expect(sched.years).toHaveLength(5);
    expect(sched.years[0]?.depreciationCents).toBe(4_000_000);
    expect(sched.totalDepreciationCents).toBe(20_000_000);
    expect(sched.years[4]?.endingBookValueCents).toBe(0);
  });
  it('respects salvage value (book ends at salvage)', () => {
    const sched = computeDepreciationSchedule({
      acquiredCostCents: 25_000_000,
      salvageValueCents: 5_000_000,
      usefulLifeYears: 5,
      method: 'STRAIGHT_LINE',
      bonusPercentage: 0,
    });
    expect(sched.totalDepreciationCents).toBe(20_000_000);
    expect(sched.years[4]?.endingBookValueCents).toBe(5_000_000);
  });
});

describe('computeDepreciationSchedule — MACRS', () => {
  it('5-yr table sums to ~100% of cost (within rounding)', () => {
    const cost = 10_000_000;
    const sched = computeDepreciationSchedule({
      acquiredCostCents: cost,
      salvageValueCents: 0,
      usefulLifeYears: 5,
      method: 'MACRS_5YR',
      bonusPercentage: 0,
    });
    expect(sched.years).toHaveLength(6); // half-year convention spreads to 6
    expect(Math.abs(sched.totalDepreciationCents - cost)).toBeLessThanOrEqual(50); // tiny rounding
  });
  it('7-yr table spreads to 8 years', () => {
    const sched = computeDepreciationSchedule({
      acquiredCostCents: 10_000_000,
      salvageValueCents: 0,
      usefulLifeYears: 7,
      method: 'MACRS_7YR',
      bonusPercentage: 0,
    });
    expect(sched.years).toHaveLength(8);
  });
});

describe('computeDepreciationSchedule — SECTION_179', () => {
  it('full year-1 expense', () => {
    const sched = computeDepreciationSchedule({
      acquiredCostCents: 5_000_000,
      salvageValueCents: 0,
      usefulLifeYears: 5,
      method: 'SECTION_179',
      bonusPercentage: 0,
    });
    expect(sched.years).toHaveLength(1);
    expect(sched.years[0]?.depreciationCents).toBe(5_000_000);
  });
});

describe('computeDepreciationSchedule — BONUS_DEPRECIATION', () => {
  it('60% year-1 + remainder straight-line over remaining life', () => {
    const sched = computeDepreciationSchedule({
      acquiredCostCents: 10_000_000,
      salvageValueCents: 0,
      usefulLifeYears: 5,
      method: 'BONUS_DEPRECIATION',
      bonusPercentage: 0.6,
    });
    // Year 1: 60% bonus = 6,000,000 plus 1/4 of remaining 4,000,000 = 1,000,000 → total 7,000,000.
    expect(sched.years[0]?.depreciationCents).toBe(7_000_000);
    expect(sched.totalDepreciationCents).toBe(10_000_000);
    expect(sched.years[4]?.endingBookValueCents).toBe(0);
  });
});

describe('depreciationForYear', () => {
  it('returns the year value', () => {
    expect(
      depreciationForYear(
        {
          acquiredCostCents: 20_000_000,
          salvageValueCents: 0,
          usefulLifeYears: 5,
          method: 'STRAIGHT_LINE',
          bonusPercentage: 0,
        },
        3,
      ),
    ).toBe(4_000_000);
  });
  it('returns 0 for years past life', () => {
    expect(
      depreciationForYear(
        {
          acquiredCostCents: 20_000_000,
          salvageValueCents: 0,
          usefulLifeYears: 5,
          method: 'STRAIGHT_LINE',
          bonusPercentage: 0,
        },
        10,
      ),
    ).toBe(0);
  });
});

describe('helpers', () => {
  it('newFixedAssetId matches fa-<8chars>', () => {
    expect(newFixedAssetId()).toMatch(/^fa-[a-z0-9]{8}$/);
  });
  it('fixedAssetCategoryLabel lowercases + replaces underscores', () => {
    expect(fixedAssetCategoryLabel('HEAVY_EQUIPMENT')).toBe('heavy equipment');
    expect(fixedAssetCategoryLabel('LAND_IMPROVEMENT')).toBe('land improvement');
  });
});
