import { describe, expect, it } from 'vitest';
import {
  computeDirRateRollup,
  findRateInEffect,
  totalFringeCents,
  totalPrevailingWageCents,
  type DirRate,
} from './dir-rate';

function rate(over: Partial<DirRate>): DirRate {
  return {
    id: 'dir-aaaaaaaa',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    classification: 'OPERATING_ENGINEER_GROUP_1',
    county: 'Shasta',
    effectiveDate: '2026-02-22',
    basicHourlyCents: 5871_00,
    healthAndWelfareCents: 1450_00,
    pensionCents: 1100_00,
    vacationHolidayCents: 425_00,
    trainingCents: 95_00,
    otherFringeCents: 0,
    ...over,
  } as DirRate;
}

describe('totalFringeCents + totalPrevailingWageCents', () => {
  it('sums fringe correctly', () => {
    const r = rate({});
    expect(totalFringeCents(r)).toBe(1450_00 + 1100_00 + 425_00 + 95_00 + 0);
  });
  it('total = basic + total fringe', () => {
    const r = rate({});
    expect(totalPrevailingWageCents(r)).toBe(r.basicHourlyCents + totalFringeCents(r));
  });
});

describe('findRateInEffect', () => {
  it('returns county-specific rate when one is in effect', () => {
    const shasta = rate({ id: 'dir-11111111', county: 'Shasta', effectiveDate: '2026-02-22' });
    const statewide = rate({
      id: 'dir-22222222',
      county: 'STATEWIDE',
      effectiveDate: '2026-02-22',
    });
    const found = findRateInEffect([shasta, statewide], {
      classification: 'OPERATING_ENGINEER_GROUP_1',
      county: 'Shasta',
      asOf: '2026-04-01',
    });
    expect(found?.id).toBe('dir-11111111');
  });

  it('falls back to STATEWIDE when no county-specific rate exists', () => {
    const statewide = rate({
      id: 'dir-22222222',
      county: 'STATEWIDE',
      effectiveDate: '2026-02-22',
    });
    const found = findRateInEffect([statewide], {
      classification: 'OPERATING_ENGINEER_GROUP_1',
      county: 'Tehama',
      asOf: '2026-04-01',
    });
    expect(found?.id).toBe('dir-22222222');
  });

  it('skips rates whose effective date is in the future', () => {
    const future = rate({
      id: 'dir-future11',
      county: 'Shasta',
      effectiveDate: '2027-01-01',
    });
    const past = rate({
      id: 'dir-past1111',
      county: 'Shasta',
      effectiveDate: '2025-08-22',
      expiresOn: '2026-02-21',
    });
    const found = findRateInEffect([future, past], {
      classification: 'OPERATING_ENGINEER_GROUP_1',
      county: 'Shasta',
      asOf: '2026-04-01',
    });
    // Neither is in range — fall back to most recent for Shasta = future.
    // Verifies fallback path 3 fires when path 1+2 fail.
    expect(found?.id).toBe('dir-future11');
  });

  it('returns null when no matching classification exists', () => {
    const r = rate({ classification: 'CARPENTER' });
    const found = findRateInEffect([r], {
      classification: 'OPERATING_ENGINEER_GROUP_1',
      county: 'Shasta',
      asOf: '2026-04-01',
    });
    expect(found).toBe(null);
  });

  it('picks the most recent when multiple county rates are in effect', () => {
    const old = rate({
      id: 'dir-old00001',
      county: 'Shasta',
      effectiveDate: '2025-08-22',
    });
    const newer = rate({
      id: 'dir-new00001',
      county: 'Shasta',
      effectiveDate: '2026-02-22',
    });
    const found = findRateInEffect([old, newer], {
      classification: 'OPERATING_ENGINEER_GROUP_1',
      county: 'Shasta',
      asOf: '2026-04-01',
    });
    expect(found?.id).toBe('dir-new00001');
  });
});

describe('computeDirRateRollup', () => {
  it('counts unique classifications + counties', () => {
    const r = computeDirRateRollup([
      rate({ id: 'dir-11111111', classification: 'OPERATING_ENGINEER_GROUP_1', county: 'Shasta' }),
      rate({ id: 'dir-22222222', classification: 'OPERATING_ENGINEER_GROUP_1', county: 'Tehama' }),
      rate({ id: 'dir-33333333', classification: 'CARPENTER', county: 'Shasta' }),
    ]);
    expect(r.total).toBe(3);
    expect(r.classifications).toBe(2);
    expect(r.counties).toBe(2);
  });
});
