// Coverage for the material-yield helper. Sanity-check that the
// bank ↔ loose ↔ compacted factors round-trip, and pin the
// real-world numbers we use across earthwork bids.

import { describe, it, expect } from 'vitest';
import { convertVolume, endDumpLoadsForExcavation } from './material-yield';

describe('convertVolume', () => {
  it('identity: bank → bank returns the input', () => {
    const r = convertVolume(
      'NATIVE_SOIL',
      { amountCY: 1000, state: 'bank' },
      'bank',
    );
    expect(r.amountCY).toBe(1000);
    expect(r.factor).toBe(1);
  });

  it('native soil bank → loose adds 25% swell', () => {
    const r = convertVolume(
      'NATIVE_SOIL',
      { amountCY: 1000, state: 'bank' },
      'loose',
    );
    expect(r.amountCY).toBe(1250);
    expect(r.factor).toBeCloseTo(1.25);
    expect(r.note).toContain('native NorCal soil');
    expect(r.note).toContain('bank→loose');
  });

  it('native soil bank → compacted shrinks 10%', () => {
    const r = convertVolume(
      'NATIVE_SOIL',
      { amountCY: 1000, state: 'bank' },
      'compacted',
    );
    expect(r.amountCY).toBe(900);
    expect(r.factor).toBeCloseTo(0.9);
  });

  it('round-trips: loose → bank → loose returns the same volume', () => {
    const original = 1250;
    const toBank = convertVolume(
      'NATIVE_SOIL',
      { amountCY: original, state: 'loose' },
      'bank',
    );
    const back = convertVolume(
      'NATIVE_SOIL',
      { amountCY: toBank.amountCY, state: 'bank' },
      'loose',
    );
    // Allow a 1 CY rounding tolerance — the helper rounds at each step.
    expect(Math.abs(back.amountCY - original)).toBeLessThanOrEqual(1);
  });

  it('Class 2 AB bank → loose ≈ 18% swell', () => {
    const r = convertVolume(
      'AGGREGATE_BASE_CLASS_2',
      { amountCY: 500, state: 'bank' },
      'loose',
    );
    expect(r.amountCY).toBeCloseTo(590, 0);
  });

  it('drain rock compacted ≈ loose (minimal compaction)', () => {
    const r = convertVolume(
      'DRAIN_ROCK_34',
      { amountCY: 100, state: 'loose' },
      'compacted',
    );
    expect(r.amountCY).toBeCloseTo(100, 0);
  });

  it('HMA loose → compacted shrinks 15%', () => {
    const r = convertVolume(
      'HMA_TYPE_A',
      { amountCY: 100, state: 'loose' },
      'compacted',
    );
    expect(r.amountCY).toBeCloseTo(85, 0);
  });

  it('throws on an unknown material', () => {
    expect(() =>
      convertVolume(
        // @ts-expect-error — deliberately bad material kind
        'UNOBTANIUM',
        { amountCY: 10, state: 'bank' },
        'loose',
      ),
    ).toThrow();
  });

  it('respects overrideFactors when project lab data is supplied', () => {
    // Lab tested this pit at 1.30 bank→loose instead of the 1.25 default.
    const r = convertVolume(
      'NATIVE_SOIL',
      { amountCY: 1000, state: 'bank' },
      'loose',
      { overrideFactors: { bank: { bank: 1, loose: 1.3, compacted: 0.9 } } },
    );
    expect(r.amountCY).toBe(1300);
    expect(r.factor).toBeCloseTo(1.3);
  });
});

describe('endDumpLoadsForExcavation', () => {
  it('rounds up partial loads (1000 bank CY native ≈ 1250 loose / 12)', () => {
    // 1250 / 12 = 104.16... → 105 loads.
    expect(endDumpLoadsForExcavation('NATIVE_SOIL', 1000)).toBe(105);
  });

  it('respects a custom truck capacity', () => {
    // 14-yard belly dumps. 1250 / 14 = 89.28... → 90 loads.
    expect(endDumpLoadsForExcavation('NATIVE_SOIL', 1000, 14)).toBe(90);
  });

  it('throws on non-positive truck capacity', () => {
    expect(() => endDumpLoadsForExcavation('NATIVE_SOIL', 100, 0)).toThrow();
    expect(() => endDumpLoadsForExcavation('NATIVE_SOIL', 100, -5)).toThrow();
  });
});
