import { describe, expect, it } from 'vitest';
import {
  DEFAULT_BURDEN,
  burdenedLaborCostCents,
  computeBurdenedRate,
  computeBurdenedRatesByClassification,
} from './labor-burden';
import type { DirClassification } from './employee';

describe('computeBurdenedRate', () => {
  it('zero rate in → zero burden out', () => {
    const r = computeBurdenedRate({
      baseRateCentsPerHour: 0,
      fringeCentsPerHour: 0,
    });
    expect(r.totalBurdenCentsPerHour).toBe(0);
    expect(r.burdenedRateCentsPerHour).toBe(0);
    expect(r.burdenMultiplier).toBe(0);
  });

  it('default burden on $60 base + $30 fringe = ~32% loaded', () => {
    // wageBase = 9000 cents.
    // Default burden total = 0.0765+0.006+0.034+0.08+0.04+0.02 = 0.2565 = 25.65%
    // Each component rounded individually so total may be off by 1 cent.
    const r = computeBurdenedRate({
      baseRateCentsPerHour: 60_00,
      fringeCentsPerHour: 30_00,
    });
    expect(r.ficaCentsPerHour).toBe(Math.round(9000 * 0.0765));
    expect(r.futaCentsPerHour).toBe(Math.round(9000 * 0.006));
    expect(r.sutaCentsPerHour).toBe(Math.round(9000 * 0.034));
    expect(r.workersCompCentsPerHour).toBe(Math.round(9000 * 0.08));
    expect(r.ptoReserveCentsPerHour).toBe(Math.round(9000 * 0.04));
    expect(r.generalOverheadCentsPerHour).toBe(Math.round(9000 * 0.02));
    // Multiplier 1 + 0.2565 = 1.2565
    expect(r.burdenMultiplier).toBeGreaterThan(1.25);
    expect(r.burdenMultiplier).toBeLessThan(1.27);
  });

  it('honors per-component overrides', () => {
    const r = computeBurdenedRate({
      baseRateCentsPerHour: 100_00,
      fringeCentsPerHour: 0,
      burden: { workersCompRate: 0.15 }, // 15% WC override
    });
    expect(r.workersCompCentsPerHour).toBe(15_00);
    // Other components stay at default
    expect(r.ficaCentsPerHour).toBe(Math.round(10_000 * DEFAULT_BURDEN.ficaRate));
  });

  it('zero burden config → wageBase passed through', () => {
    const r = computeBurdenedRate({
      baseRateCentsPerHour: 50_00,
      fringeCentsPerHour: 25_00,
      burden: {
        ficaRate: 0,
        futaRate: 0,
        sutaRate: 0,
        workersCompRate: 0,
        ptoReserveRate: 0,
        generalOverheadRate: 0,
      },
    });
    expect(r.totalBurdenCentsPerHour).toBe(0);
    expect(r.burdenedRateCentsPerHour).toBe(75_00);
    expect(r.burdenMultiplier).toBe(1);
  });
});

describe('computeBurdenedRatesByClassification', () => {
  it('processes each classification independently', () => {
    const rates = new Map<DirClassification, { baseCentsPerHour: number; fringeCentsPerHour: number }>([
      ['OPERATING_ENGINEER_GROUP_1', { baseCentsPerHour: 60_00, fringeCentsPerHour: 30_00 }],
      ['LABORER_GROUP_1', { baseCentsPerHour: 40_00, fringeCentsPerHour: 20_00 }],
    ]);
    const out = computeBurdenedRatesByClassification(rates);
    expect(out.size).toBe(2);
    expect(out.get('OPERATING_ENGINEER_GROUP_1')?.burdenedRateCentsPerHour).toBeGreaterThan(90_00);
    expect(out.get('LABORER_GROUP_1')?.burdenedRateCentsPerHour).toBeGreaterThan(60_00);
  });

  it('applies a uniform burden override across all classifications', () => {
    const rates = new Map<DirClassification, { baseCentsPerHour: number; fringeCentsPerHour: number }>([
      ['OPERATING_ENGINEER_GROUP_1', { baseCentsPerHour: 100_00, fringeCentsPerHour: 0 }],
    ]);
    const out = computeBurdenedRatesByClassification(rates, {
      workersCompRate: 0.20, // very high WC tier
    });
    expect(out.get('OPERATING_ENGINEER_GROUP_1')?.workersCompCentsPerHour).toBe(20_00);
  });
});

describe('burdenedLaborCostCents', () => {
  it('multiplies hours × burdened rate', () => {
    const breakdown = computeBurdenedRate({
      baseRateCentsPerHour: 100_00,
      fringeCentsPerHour: 0,
      burden: { ficaRate: 0, futaRate: 0, sutaRate: 0, workersCompRate: 0, ptoReserveRate: 0, generalOverheadRate: 0 },
    });
    expect(burdenedLaborCostCents(40, breakdown)).toBe(40 * 100_00);
  });

  it('returns 0 for non-positive hours', () => {
    const breakdown = computeBurdenedRate({
      baseRateCentsPerHour: 100_00,
      fringeCentsPerHour: 0,
    });
    expect(burdenedLaborCostCents(0, breakdown)).toBe(0);
    expect(burdenedLaborCostCents(-5, breakdown)).toBe(0);
    expect(burdenedLaborCostCents(NaN, breakdown)).toBe(0);
  });
});
