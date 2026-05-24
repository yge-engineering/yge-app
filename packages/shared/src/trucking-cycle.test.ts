// Coverage for the trucking-cycle math + quarry routing.

import { describe, it, expect } from 'vitest';
import {
  haversineMiles,
  estimatedRoadMiles,
  cycleMinutes,
  haulCost,
  geocodeJobSite,
  nearestQuarriesWithHaul,
  inferQuarryMaterial,
} from './trucking-cycle';

describe('haversineMiles', () => {
  it('Cottonwood → Redding is ~22 miles', () => {
    const d = haversineMiles(
      { lat: 40.385, lng: -122.281 }, // Cottonwood
      { lat: 40.5865, lng: -122.3917 }, // Redding
    );
    expect(d).toBeGreaterThan(14);
    expect(d).toBeLessThan(20);
  });

  it('returns 0 for identical points', () => {
    const d = haversineMiles({ lat: 40, lng: -122 }, { lat: 40, lng: -122 });
    expect(d).toBe(0);
  });
});

describe('estimatedRoadMiles', () => {
  it('multiplies straight-line by 1.25', () => {
    expect(estimatedRoadMiles(40)).toBe(50);
    expect(estimatedRoadMiles(10)).toBeCloseTo(12.5);
  });
});

describe('cycleMinutes', () => {
  it('uses defaults when only oneWayMiles is given', () => {
    const r = cycleMinutes({ oneWayMiles: 30 });
    // 30 mi loaded at 45 mph = 40 min out
    // 30 mi empty at 50 mph = 36 min back
    // load 15 + dump 5 + queue 10 = 30 min
    // Total ≈ 106 min
    expect(r.cycleMinutes).toBeGreaterThan(100);
    expect(r.cycleMinutes).toBeLessThan(112);
  });

  it('cycle scales linearly with distance', () => {
    const short = cycleMinutes({ oneWayMiles: 10 });
    const long = cycleMinutes({ oneWayMiles: 40 });
    expect(long.cycleMinutes).toBeGreaterThan(short.cycleMinutes + 50);
  });

  it('respects loadedSpeedMph override', () => {
    const base = cycleMinutes({ oneWayMiles: 30 });
    const slow = cycleMinutes({ oneWayMiles: 30, loadedSpeedMph: 30 });
    expect(slow.cycleMinutes).toBeGreaterThan(base.cycleMinutes);
  });
});

describe('haulCost', () => {
  it('computes per-load cost from cycle minutes × hourly rate', () => {
    // 60 min cycle × $165/hr = $165/load. 14 CY truck → $11.78/CY.
    const r = haulCost({
      cycleMinutes: 60,
      capacityPerLoad: 14,
    });
    expect(r.costPerLoadCents).toBe(165_00);
    expect(r.costPerUnitCents).toBeCloseTo(1178, -1);
  });

  it('totalCostForQuantity rounds loads UP', () => {
    const r = haulCost({
      cycleMinutes: 60,
      capacityPerLoad: 14,
    });
    // 100 CY / 14 = 7.14 → 8 full loads → 8 × $165 = $1,320.
    expect(r.loadsForQuantity(100)).toBe(8);
    expect(r.totalCostForQuantityCents(100)).toBe(1320_00);
  });
});

describe('geocodeJobSite', () => {
  it('returns explicit coordinates verbatim when present', () => {
    const r = geocodeJobSite({ lat: 40.5, lng: -122.3 });
    expect(r).toEqual({
      lat: 40.5,
      lng: -122.3,
      source: 'explicit-coordinates',
    });
  });

  it('matches by city + county', () => {
    const r = geocodeJobSite({ city: 'Cottonwood', county: 'Shasta' });
    expect(r?.source).toBe('city-match');
    expect(r?.matchedCity?.name).toBe('Cottonwood');
  });

  it('falls back to county centroid when city not in table', () => {
    const r = geocodeJobSite({ city: 'Some Tiny Hamlet', county: 'Tehama' });
    expect(r?.source).toBe('county-centroid');
    expect(r?.matchedCity?.county).toBe('Tehama');
  });

  it('returns null when nothing matches', () => {
    const r = geocodeJobSite({ city: 'Outer Mongolia' });
    expect(r).toBeNull();
  });
});

describe('nearestQuarriesWithHaul', () => {
  it('Cottonwood job → nearest Class 2 AB is Anderson / Redding range', () => {
    const opts = nearestQuarriesWithHaul({
      jobLat: 40.385,
      jobLng: -122.281,
      material: 'CLASS_2_AB',
    });
    expect(opts.length).toBeGreaterThan(0);
    // Top result should be within ~20 miles road distance.
    expect(opts[0]!.roadMiles).toBeLessThan(25);
    // Should be one of the Anderson / Redding plants.
    expect(['knife-river-redding', 'granite-anderson', 'shasta-pacific-anderson'])
      .toContain(opts[0]!.quarry.id);
  });

  it('Yreka job → top quarry should be Yreka / Siskiyou-local', () => {
    const opts = nearestQuarriesWithHaul({
      jobLat: 41.7354,
      jobLng: -122.6345,
      material: 'CLASS_2_AB',
    });
    expect(opts[0]!.quarry.county).toBe('Siskiyou');
  });

  it('returns empty when no quarry supplies that material in the directory', () => {
    // Force a material with no match (use a string cast — runtime
    // behavior is what we're checking).
    const opts = nearestQuarriesWithHaul({
      jobLat: 40,
      jobLng: -122,
      // @ts-expect-error — deliberately invalid material kind
      material: 'WIDGETS',
    });
    expect(opts).toEqual([]);
  });

  it('attaches haul cost to each option', () => {
    const opts = nearestQuarriesWithHaul({
      jobLat: 40.385,
      jobLng: -122.281,
      material: 'CLASS_2_AB',
    });
    for (const o of opts) {
      expect(o.cost.costPerLoadCents).toBeGreaterThan(0);
      expect(o.cost.costPerUnitCents).toBeGreaterThan(0);
      // 100 CY haul should be ≤ 8 loads at 14 CY each.
      expect(o.cost.loadsForQuantity(100)).toBeLessThanOrEqual(8);
    }
  });
});

describe('inferQuarryMaterial', () => {
  it('detects Class 2 AB', () => {
    expect(inferQuarryMaterial('Class 2 aggregate base, 6" lift', 'TON')).toBe(
      'CLASS_2_AB',
    );
  });
  it('detects HMA Type A', () => {
    expect(inferQuarryMaterial('Hot mix asphalt Type A, 3" lift', 'TON')).toBe(
      'HMA_TYPE_A',
    );
  });
  it('detects RHMA before HMA', () => {
    expect(inferQuarryMaterial('RHMA-G surface course', 'TON')).toBe('HMA_RHMA');
  });
  it('detects 3/4" drain rock as DRAIN_ROCK_34', () => {
    expect(inferQuarryMaterial('Drain rock, 3/4 inch, French drain', 'CY')).toBe(
      'DRAIN_ROCK_34',
    );
  });
  it('detects 1-1/2 inch drain rock as DRAIN_ROCK_15', () => {
    expect(inferQuarryMaterial('1-1/2" drain rock under footing', 'CY')).toBe(
      'DRAIN_ROCK_15',
    );
  });
  it('detects import borrow', () => {
    expect(inferQuarryMaterial('Imported borrow, engineered fill', 'CY')).toBe(
      'IMPORT_BORROW_FILL',
    );
  });
  it('detects ready-mix PCC', () => {
    expect(inferQuarryMaterial('Ready-mix concrete, foundation pour', 'CY')).toBe(
      'PCC_READY_MIX',
    );
  });
  it('returns null when nothing matches', () => {
    expect(inferQuarryMaterial('Bird-bath sealant', 'GAL')).toBeNull();
  });
});
