// Coverage for the production-rates reference + helpers.

import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRODUCTION_RATES,
  SITE_CONDITION_MULTIPLIER,
  SITE_CONDITION_NOTE,
  findBestRate,
  applySiteConditionMultiplier,
  crewDaysForQuantity,
} from './production-rates';

describe('DEFAULT_PRODUCTION_RATES', () => {
  it('has a sensible mix of categories', () => {
    const cats = new Set(DEFAULT_PRODUCTION_RATES.map((r) => r.category));
    expect(cats.has('EARTHWORK')).toBe(true);
    expect(cats.has('UTILITY')).toBe(true);
    expect(cats.has('CONCRETE')).toBe(true);
    expect(cats.has('FENCE')).toBe(true);
    expect(cats.has('PAVING')).toBe(true);
  });

  it('every rate has low <= high and a positive crew size', () => {
    for (const r of DEFAULT_PRODUCTION_RATES) {
      expect(r.perCrewDayLow).toBeGreaterThan(0);
      expect(r.perCrewDayHigh).toBeGreaterThanOrEqual(r.perCrewDayLow);
      expect(r.crewSize).toBeGreaterThan(0);
    }
  });
});

describe('findBestRate', () => {
  it('finds the structural-fill rate from a typical description', () => {
    const r = findBestRate({
      description: 'Structural fill, imported, 95% compaction',
      unit: 'CY',
    });
    expect(r?.id).toBe('structural-fill-95pct');
  });

  it('finds the chain-link fence rate', () => {
    const r = findBestRate({
      description: 'Chain-link security fence with barbed wire, 8 ft tall',
      unit: 'LF',
    });
    expect(r?.id).toBe('chain-link-fence-install');
  });

  it('finds the conduit rate', () => {
    const r = findBestRate({
      description: '2-inch PVC conduit trench + lay + backfill',
      unit: 'LF',
    });
    expect(r?.id).toBe('conduit-trench-pull');
  });

  it('returns undefined when unit does not match any rate', () => {
    const r = findBestRate({
      description: 'Something',
      unit: 'GALLON_OF_PAINT', // not in library
    });
    expect(r).toBeUndefined();
  });

  it('returns undefined when no description tokens match a known task', () => {
    const r = findBestRate({
      description: 'Unobtanium widget assembly',
      unit: 'CY',
    });
    expect(r).toBeUndefined();
  });
});

describe('applySiteConditionMultiplier', () => {
  it('GREENFIELD is 1.0', () => {
    expect(applySiteConditionMultiplier(10, 'GREENFIELD')).toBe(10);
  });
  it('LIVE roughly 1.7x', () => {
    expect(applySiteConditionMultiplier(10, 'LIVE')).toBeCloseTo(17);
  });
  it('PARTIAL_LIVE between greenfield and live', () => {
    const v = applySiteConditionMultiplier(10, 'PARTIAL_LIVE');
    expect(v).toBeGreaterThan(10);
    expect(v).toBeLessThan(17);
  });
  it('UNKNOWN matches PARTIAL_LIVE (worst-of-two-evils default)', () => {
    expect(applySiteConditionMultiplier(10, 'UNKNOWN')).toBe(
      applySiteConditionMultiplier(10, 'PARTIAL_LIVE'),
    );
  });
});

describe('crewDaysForQuantity', () => {
  it('uses the midpoint of low/high', () => {
    // structural fill: 200–400 → midpoint 300. 1200 CY = 4 days.
    const r = DEFAULT_PRODUCTION_RATES.find(
      (x) => x.id === 'structural-fill-95pct',
    )!;
    const days = crewDaysForQuantity(1200, r);
    expect(days).toBeCloseTo(4, 1);
  });
  it('returns 0 for zero quantity', () => {
    const r = DEFAULT_PRODUCTION_RATES[0]!;
    expect(crewDaysForQuantity(0, r)).toBe(0);
  });
  it('end-to-end: 2400 LF conduit @ ~275/day = ~8.7 days, ×1.7 LIVE = ~15 days', () => {
    const r = DEFAULT_PRODUCTION_RATES.find(
      (x) => x.id === 'conduit-trench-pull',
    )!;
    const days = crewDaysForQuantity(2400, r);
    const live = applySiteConditionMultiplier(days, 'LIVE');
    expect(live).toBeGreaterThan(13);
    expect(live).toBeLessThan(17);
  });
});

describe('SITE_CONDITION_MULTIPLIER / NOTE consistency', () => {
  it('covers every SiteCondition', () => {
    const expected: Array<keyof typeof SITE_CONDITION_MULTIPLIER> = [
      'LIVE',
      'GREENFIELD',
      'PARTIAL_LIVE',
      'UNKNOWN',
    ];
    for (const k of expected) {
      expect(SITE_CONDITION_MULTIPLIER[k]).toBeGreaterThan(0);
      expect(SITE_CONDITION_NOTE[k].length).toBeGreaterThan(20);
    }
  });
});
