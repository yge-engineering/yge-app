import { describe, it, expect } from 'vitest';
import {
  PlanTakeoffSchema,
  PlanTakeoffCreateSchema,
  TakeoffMeasurementSchema,
  euclideanDistance,
  shoelaceArea,
  polylineLength,
  feetPerPlanUnit,
  planLengthToFeet,
  planAreaToSquareFeet,
  measurementValue,
  defaultMeasurementColor,
  newPlanTakeoffId,
  newPlanMeasurementId,
  takeoffMeasurementKindLabel,
  type PlanScale,
  type PlanPoint,
} from './plan-takeoff';

const sq = (n: number) => ({ x: n, y: n } as PlanPoint);

// A simple calibration: 100 plan-units = 50 ft → 0.5 ft per plan-unit.
const SCALE_HALF: PlanScale = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 100, y: 0 },
  realDistance: 50,
  realUnit: 'FT',
};

describe('math helpers', () => {
  it('euclideanDistance: 3-4-5 right triangle → 5', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('shoelaceArea: 10×10 square → 100', () => {
    expect(
      shoelaceArea([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ]),
    ).toBe(100);
  });

  it('shoelaceArea: < 3 points → 0', () => {
    expect(shoelaceArea([])).toBe(0);
    expect(shoelaceArea([{ x: 0, y: 0 }])).toBe(0);
    expect(shoelaceArea([{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(0);
  });

  it('shoelaceArea: handles winding direction (returns absolute area)', () => {
    const cw = [
      { x: 0, y: 0 },
      { x: 0, y: 10 },
      { x: 10, y: 10 },
      { x: 10, y: 0 },
    ];
    expect(shoelaceArea(cw)).toBe(100);
  });

  it('polylineLength: 3 segments of a unit-step chain', () => {
    // (0,0) → (3,0) → (3,4) → (3,4): segments 3 + 4 + 0 = 7
    const pts = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 3, y: 4 },
      { x: 3, y: 4 },
    ];
    expect(polylineLength(pts)).toBe(7);
  });

  it('polylineLength: < 2 points → 0', () => {
    expect(polylineLength([])).toBe(0);
    expect(polylineLength([{ x: 1, y: 2 }])).toBe(0);
  });

  it('feetPerPlanUnit: 100 plan units = 50 ft → 0.5', () => {
    expect(feetPerPlanUnit(SCALE_HALF)).toBe(0.5);
  });

  it('feetPerPlanUnit: zero plan distance → 0 (avoids divide-by-zero)', () => {
    expect(
      feetPerPlanUnit({
        pointA: { x: 5, y: 5 },
        pointB: { x: 5, y: 5 },
        realDistance: 50,
        realUnit: 'FT',
      }),
    ).toBe(0);
  });

  it('feetPerPlanUnit: scale unit IN/YD/M/CM convert correctly', () => {
    const base = { pointA: { x: 0, y: 0 }, pointB: { x: 100, y: 0 }, realDistance: 1 };
    expect(feetPerPlanUnit({ ...base, realUnit: 'FT' })).toBeCloseTo(0.01, 6);
    // 1 yard = 3 ft
    expect(feetPerPlanUnit({ ...base, realUnit: 'YD' })).toBeCloseTo(0.03, 6);
    // 1 inch = 1/12 ft
    expect(feetPerPlanUnit({ ...base, realUnit: 'IN' })).toBeCloseTo(1 / 1200, 6);
    // 1 m = 3.28084 ft
    expect(feetPerPlanUnit({ ...base, realUnit: 'M' })).toBeCloseTo(0.0328084, 6);
    expect(feetPerPlanUnit({ ...base, realUnit: 'CM' })).toBeCloseTo(0.000328084, 6);
  });

  it('planLengthToFeet: 200 plan units at 0.5 ratio → 100 ft', () => {
    expect(planLengthToFeet(200, SCALE_HALF)).toBe(100);
  });

  it('planAreaToSquareFeet: 100×100 plan area at 0.5 ratio → 2500 SF (50×50 ft)', () => {
    // planArea = 100*100 = 10000 (plan-units²)
    // real area = 10000 * 0.5² = 2500 SF
    expect(planAreaToSquareFeet(10000, SCALE_HALF)).toBe(2500);
  });
});

describe('measurementValue', () => {
  it('COUNT: returns count of stamps in EA regardless of scale', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-1',
      kind: 'COUNT',
      points: [sq(0), sq(1), sq(2), sq(3)],
    });
    expect(measurementValue(m, undefined)).toEqual({ value: 4, unit: 'EA' });
    expect(measurementValue(m, SCALE_HALF)).toEqual({ value: 4, unit: 'EA' });
  });

  it('LENGTH: returns 0 with no scale', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-2',
      kind: 'LENGTH',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    });
    expect(measurementValue(m, undefined)).toEqual({ value: 0, unit: 'LF' });
  });

  it('LENGTH: 100 plan units at half-scale → 50 LF', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-3',
      kind: 'LENGTH',
      points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
    });
    expect(measurementValue(m, SCALE_HALF)).toEqual({ value: 50, unit: 'LF' });
  });

  it('LENGTH: missing second point → 0', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-4',
      kind: 'LENGTH',
      points: [{ x: 0, y: 0 }],
    });
    expect(measurementValue(m, SCALE_HALF)).toEqual({ value: 0, unit: 'LF' });
  });

  it('POLYLINE: chain of 3 segments at half-scale', () => {
    // (0,0)→(3,0)→(3,4)→(3,4) = 7 plan-units → 3.5 LF at 0.5 ratio
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-5',
      kind: 'POLYLINE',
      points: [
        { x: 0, y: 0 },
        { x: 3, y: 0 },
        { x: 3, y: 4 },
        { x: 3, y: 4 },
      ],
    });
    expect(measurementValue(m, SCALE_HALF)).toEqual({ value: 3.5, unit: 'LF' });
  });

  it('AREA: 10×10 plan square at half-scale → 25 SF (5×5 ft)', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-6',
      kind: 'AREA',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    });
    expect(measurementValue(m, SCALE_HALF)).toEqual({ value: 25, unit: 'SF' });
  });

  it('VOLUME: 10×10 plan square at half-scale, depth 3 ft → 25 SF × 3 ft = 75 CF → 75/27 CY', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-7',
      kind: 'VOLUME',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
      depthFeet: 3,
    });
    const out = measurementValue(m, SCALE_HALF);
    expect(out.unit).toBe('CY');
    expect(out.value).toBeCloseTo(75 / 27, 8);
  });

  it('VOLUME: no depth → 0 CY', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-8',
      kind: 'VOLUME',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
      ],
    });
    expect(measurementValue(m, SCALE_HALF).value).toBe(0);
  });

  it('RADIUS: 10-unit radius at half-scale → 2π·5 LF circumference', () => {
    const m = TakeoffMeasurementSchema.parse({
      id: 'm-9',
      kind: 'RADIUS',
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    const out = measurementValue(m, SCALE_HALF);
    expect(out.unit).toBe('LF');
    expect(out.value).toBeCloseTo(2 * Math.PI * 5, 8);
  });
});

describe('PlanTakeoffSchema', () => {
  it('parses a minimal valid takeoff and applies defaults', () => {
    const t = PlanTakeoffSchema.parse({
      id: 'pt-12345678',
      createdAt: '2026-05-22T08:00:00Z',
      updatedAt: '2026-05-22T08:00:00Z',
      planRef: 'doc-abc',
      name: 'Sulphur Springs — Plan Set',
    });
    expect(t.sheets).toEqual([]);
  });

  it('rejects a measurement with a bad color', () => {
    expect(
      TakeoffMeasurementSchema.safeParse({
        id: 'm-1',
        kind: 'COUNT',
        color: 'red',
      }).success,
    ).toBe(false);
  });

  it('accepts a measurement with a 6-hex color', () => {
    expect(
      TakeoffMeasurementSchema.safeParse({
        id: 'm-1',
        kind: 'COUNT',
        color: '#dc2626',
      }).success,
    ).toBe(true);
  });
});

describe('PlanTakeoffCreateSchema', () => {
  it('omits id and timestamps and accepts optional sheets', () => {
    const c = PlanTakeoffCreateSchema.parse({
      planRef: 'doc-abc',
      name: 'Plan',
    });
    expect(c.name).toBe('Plan');
  });
});

describe('defaultMeasurementColor', () => {
  it('returns a 6-hex color for every kind', () => {
    const kinds = ['LENGTH', 'AREA', 'COUNT', 'POLYLINE', 'RADIUS', 'VOLUME'] as const;
    for (const k of kinds) {
      expect(defaultMeasurementColor(k)).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('id generators', () => {
  it('newPlanTakeoffId produces pt-<8chars>', () => {
    expect(newPlanTakeoffId()).toMatch(/^pt-[a-z0-9]{8}$/);
  });

  it('newPlanMeasurementId produces m-<8chars>', () => {
    expect(newPlanMeasurementId()).toMatch(/^m-[a-z0-9]{8}$/);
  });
});

describe('takeoffMeasurementKindLabel', () => {
  it('lowercases', () => {
    expect(takeoffMeasurementKindLabel('LENGTH')).toBe('length');
    expect(takeoffMeasurementKindLabel('POLYLINE')).toBe('polyline');
  });
});
