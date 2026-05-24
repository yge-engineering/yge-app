// Coverage for the YGE preferred-supplier routing rules.

import { describe, it, expect } from 'vitest';
import {
  findYgePreferredQuarryId,
  SAC_AREA_REGION,
  UP_NORTH_REGION,
  YGE_QUARRY_PREFERENCES,
} from './yge-quarry-preferences';

describe('findYgePreferredQuarryId', () => {
  it('Sac County Class 2 AB → Teichert Grantline', () => {
    const r = findYgePreferredQuarryId({
      material: 'CLASS_2_AB',
      jobCounty: 'Sacramento',
    });
    expect(r?.quarryId).toBe('teichert-grantline');
    expect(r?.reason).toContain('Sac');
  });

  it('Placer County Class 2 AB → Teichert Grantline (also in Sac region)', () => {
    const r = findYgePreferredQuarryId({
      material: 'CLASS_2_AB',
      jobCounty: 'Placer',
    });
    expect(r?.quarryId).toBe('teichert-grantline');
  });

  it('"Sacramento County" with the suffix still matches', () => {
    const r = findYgePreferredQuarryId({
      material: 'CLASS_2_AB',
      jobCounty: 'Sacramento County',
    });
    expect(r?.quarryId).toBe('teichert-grantline');
  });

  it('Shasta County Class 2 AB → no preferred (falls through to nearest)', () => {
    const r = findYgePreferredQuarryId({
      material: 'CLASS_2_AB',
      jobCounty: 'Shasta',
    });
    expect(r).toBeNull();
  });

  it('Sac County top-course crushed rock → George Reed Ione', () => {
    const r = findYgePreferredQuarryId({
      material: 'CRUSHED_ROCK_FINISH',
      jobCounty: 'Sacramento',
    });
    expect(r?.quarryId).toBe('george-reed-ione');
  });

  it('Tehama County riprap → no preferred (up-north exclusion fires)', () => {
    const r = findYgePreferredQuarryId({
      material: 'RIPRAP_QUARTER_TON',
      jobCounty: 'Tehama',
    });
    expect(r).toBeNull();
  });

  it('Shasta County riprap → no preferred (up-north exclusion fires)', () => {
    const r = findYgePreferredQuarryId({
      material: 'RIPRAP_TWO_TON',
      jobCounty: 'Shasta',
    });
    expect(r).toBeNull();
  });

  it('Yolo County riprap → George Reed Ione (not up-north)', () => {
    const r = findYgePreferredQuarryId({
      material: 'RIPRAP_QUARTER_TON',
      jobCounty: 'Yolo',
    });
    expect(r?.quarryId).toBe('george-reed-ione');
  });

  it('All three riprap sizes route the same way', () => {
    for (const m of ['RIPRAP_QUARTER_TON', 'RIPRAP_HALF_TON', 'RIPRAP_TWO_TON'] as const) {
      const yolo = findYgePreferredQuarryId({ material: m, jobCounty: 'Yolo' });
      const shasta = findYgePreferredQuarryId({ material: m, jobCounty: 'Shasta' });
      expect(yolo?.quarryId).toBe('george-reed-ione');
      expect(shasta).toBeNull();
    }
  });

  it('returns null for materials with no rule (e.g. HMA Type A)', () => {
    const r = findYgePreferredQuarryId({
      material: 'HMA_TYPE_A',
      jobCounty: 'Sacramento',
    });
    expect(r).toBeNull();
  });

  it('returns null when jobCounty is missing entirely', () => {
    const r = findYgePreferredQuarryId({ material: 'CLASS_2_AB' });
    expect(r).toBeNull();
  });
});

describe('region tables', () => {
  it('SAC_AREA_REGION includes the expected counties', () => {
    expect(SAC_AREA_REGION.counties).toContain('sacramento');
    expect(SAC_AREA_REGION.counties).toContain('placer');
    expect(SAC_AREA_REGION.counties).toContain('amador');
  });

  it('UP_NORTH_REGION includes Shasta + Modoc', () => {
    expect(UP_NORTH_REGION.counties).toContain('shasta');
    expect(UP_NORTH_REGION.counties).toContain('modoc');
  });

  it('YGE_QUARRY_PREFERENCES references only known quarry ids', () => {
    // Smoke test — every quarryId mentioned must be a valid
    // identifier shape (lowercase + hyphens). Runtime existence is
    // covered by trucking-cycle.test.ts via the quarry lookups.
    for (const rule of YGE_QUARRY_PREFERENCES) {
      expect(rule.quarryId).toMatch(/^[a-z0-9-]+$/);
    }
  });
});
