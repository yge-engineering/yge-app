import { describe, it, expect } from 'vitest';
import {
  DOT_ALCOHOL_RATE,
  DOT_DRUG_RATE,
  computeAnnualTargets,
  hashSeed,
  mulberry32,
  quarterlyTargetPerPeriod,
  selectRandomPool,
  type DotDriver,
} from './dot-random-pool';

function makeRoster(n: number, allActive = true): DotDriver[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${i + 1}`,
    name: `Driver ${String.fromCharCode(65 + (i % 26))}${i}`,
    active: allActive,
  }));
}

describe('computeAnnualTargets', () => {
  it('applies the 50% drug + 10% alcohol rate from 49 CFR §382.305', () => {
    const r = computeAnnualTargets(20);
    expect(r.drugTests).toBe(10);
    expect(r.alcoholTests).toBe(2);
  });

  it('rounds up rather than down (compliance error otherwise)', () => {
    const r = computeAnnualTargets(15);
    expect(r.drugTests).toBe(Math.ceil(15 * DOT_DRUG_RATE));
    expect(r.alcoholTests).toBe(Math.ceil(15 * DOT_ALCOHOL_RATE));
    // Specifically: 15 × 0.5 = 7.5 → 8.   15 × 0.1 = 1.5 → 2.
    expect(r.drugTests).toBe(8);
    expect(r.alcoholTests).toBe(2);
  });

  it('returns 0 for empty roster', () => {
    expect(computeAnnualTargets(0)).toEqual({ drugTests: 0, alcoholTests: 0 });
  });

  it('throws on negative input', () => {
    expect(() => computeAnnualTargets(-1)).toThrow();
  });
});

describe('quarterlyTargetPerPeriod', () => {
  it('divides evenly when annual is divisible by periods', () => {
    expect(quarterlyTargetPerPeriod(8, 4, 0)).toBe(2);
    expect(quarterlyTargetPerPeriod(8, 4, 3)).toBe(2);
  });

  it('front-loads remainders into earliest periods', () => {
    // 9 across 4 periods → 3, 2, 2, 2.
    expect(quarterlyTargetPerPeriod(9, 4, 0)).toBe(3);
    expect(quarterlyTargetPerPeriod(9, 4, 1)).toBe(2);
    expect(quarterlyTargetPerPeriod(9, 4, 3)).toBe(2);
  });

  it('rejects bad inputs', () => {
    expect(() => quarterlyTargetPerPeriod(4, 0, 0)).toThrow();
    expect(() => quarterlyTargetPerPeriod(4, 4, -1)).toThrow();
    expect(() => quarterlyTargetPerPeriod(4, 4, 4)).toThrow();
  });
});

describe('selectRandomPool', () => {
  it('returns exactly selectCount ids when pool is large enough', () => {
    const roster = makeRoster(20);
    const rng = mulberry32(hashSeed('2026Q1-DRUG'));
    const r = selectRandomPool(roster, { testType: 'DRUG', selectCount: 5, rng });
    expect(r.selectedDriverIds).toHaveLength(5);
    expect(r.poolSize).toBe(20);
  });

  it('is deterministic given the same seed', () => {
    const roster = makeRoster(20);
    const a = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 5,
      rng: mulberry32(hashSeed('2026Q1-DRUG')),
    });
    const b = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 5,
      rng: mulberry32(hashSeed('2026Q1-DRUG')),
    });
    expect(a.selectedDriverIds).toEqual(b.selectedDriverIds);
  });

  it('changes selection when seed changes', () => {
    const roster = makeRoster(20);
    const a = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 5,
      rng: mulberry32(hashSeed('2026Q1-DRUG')),
    });
    const b = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 5,
      rng: mulberry32(hashSeed('2026Q2-DRUG')),
    });
    expect(a.selectedDriverIds).not.toEqual(b.selectedDriverIds);
  });

  it('excludes inactive drivers from the pool', () => {
    const roster = makeRoster(20);
    roster[0]!.active = false;
    roster[1]!.active = false;
    const r = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 3,
      rng: mulberry32(123),
    });
    expect(r.poolSize).toBe(18);
    expect(r.selectedDriverIds).not.toContain('e1');
    expect(r.selectedDriverIds).not.toContain('e2');
  });

  it('throws when selectCount exceeds pool size', () => {
    const roster = makeRoster(3);
    expect(() =>
      selectRandomPool(roster, { testType: 'DRUG', selectCount: 5, rng: mulberry32(1) }),
    ).toThrow(/exceeds active pool size/);
  });

  it('does not pick the same driver twice within a round', () => {
    const roster = makeRoster(10);
    const r = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 5,
      rng: mulberry32(42),
    });
    expect(new Set(r.selectedDriverIds).size).toBe(5);
  });

  it('returns names sorted (printable order)', () => {
    const roster: DotDriver[] = [
      { id: 'e1', name: 'Zane', active: true },
      { id: 'e2', name: 'Aaron', active: true },
      { id: 'e3', name: 'Mike', active: true },
    ];
    const r = selectRandomPool(roster, {
      testType: 'DRUG',
      selectCount: 3,
      rng: mulberry32(7),
    });
    // Should be Aaron(e2), Mike(e3), Zane(e1)
    expect(r.selectedDriverIds).toEqual(['e2', 'e3', 'e1']);
  });
});

describe('mulberry32 + hashSeed', () => {
  it('mulberry32 returns numbers in [0, 1)', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 100; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('hashSeed is stable across calls', () => {
    expect(hashSeed('2026Q2-DRUG')).toBe(hashSeed('2026Q2-DRUG'));
    expect(hashSeed('2026Q2-DRUG')).not.toBe(hashSeed('2026Q3-DRUG'));
  });
});
