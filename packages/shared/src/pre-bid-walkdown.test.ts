// Coverage for the pre-bid walkdown checklist builder.
// Pin per-type item counts so a template tweak shows up as an
// intentional behavior change in the failing test, not a silent drift.

import { describe, it, expect } from 'vitest';
import { buildWalkdownChecklist, walkdownItemCount } from './pre-bid-walkdown';

const COMMON_COUNT = 7;

describe('buildWalkdownChecklist', () => {
  it('every project type returns at least the common items', () => {
    for (const t of [
      'ROAD_RECONSTRUCTION',
      'DRAINAGE',
      'BRIDGE',
      'GRADING',
      'FIRE_FUEL_REDUCTION',
      'OTHER',
    ] as const) {
      const list = buildWalkdownChecklist(t);
      expect(list.items.length).toBeGreaterThanOrEqual(COMMON_COUNT);
      // Common items are first; confirm a known common id is present.
      expect(list.items.some((i) => i.id === 'common-water')).toBe(true);
    }
  });

  it('ROAD_RECONSTRUCTION includes core/probe item', () => {
    const list = buildWalkdownChecklist('ROAD_RECONSTRUCTION');
    expect(list.items.some((i) => i.id === 'road-existing-pavement')).toBe(true);
    expect(list.items.length).toBe(COMMON_COUNT + 4);
  });

  it('DRAINAGE flags the streambed-alteration permit check', () => {
    const list = buildWalkdownChecklist('DRAINAGE');
    const permit = list.items.find((i) => i.id === 'drain-permits');
    expect(permit).toBeDefined();
    expect(permit!.label).toContain('Section 401');
  });

  it('FIRE_FUEL_REDUCTION calls out spotted-owl LOP and slope class', () => {
    const list = buildWalkdownChecklist('FIRE_FUEL_REDUCTION');
    expect(list.items.some((i) => i.id === 'ffr-slope-class')).toBe(true);
    expect(list.items.some((i) => i.id === 'ffr-spotted-owl')).toBe(true);
  });

  it('OTHER falls back to a write-the-scope item', () => {
    const list = buildWalkdownChecklist('OTHER');
    expect(list.items.length).toBe(COMMON_COUNT + 1);
    expect(list.items[COMMON_COUNT]!.id).toBe('other-scope');
  });

  it('every item has a stable id and a non-empty label', () => {
    for (const t of [
      'ROAD_RECONSTRUCTION',
      'DRAINAGE',
      'BRIDGE',
      'GRADING',
      'FIRE_FUEL_REDUCTION',
      'OTHER',
    ] as const) {
      const list = buildWalkdownChecklist(t);
      for (const item of list.items) {
        expect(item.id.length).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
      }
      // No id duplicates within a type.
      const ids = list.items.map((i) => i.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe('walkdownItemCount', () => {
  it('matches the built list length', () => {
    for (const t of ['ROAD_RECONSTRUCTION', 'DRAINAGE'] as const) {
      expect(walkdownItemCount(t)).toBe(buildWalkdownChecklist(t).items.length);
    }
  });
});
