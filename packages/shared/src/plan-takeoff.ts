// Plan takeoff — measurements on a PDF plan set.
//
// A takeoff is a per-PDF collection of measurements organized by sheet.
// Each measurement is a kind (length / area / count / polyline / radius /
// volume) plus a list of plan-page-coordinate points and a few labels. A
// per-sheet scale calibration converts plan-page units to real-world feet.
//
// Geometry interpretation per kind:
//   LENGTH   — two points (a, b); value = euclidean distance × scale, in LF
//   POLYLINE — N points (>= 2); value = sum of segment lengths, in LF
//   AREA     — N polygon vertices (>= 3); value = shoelace, in SF
//   VOLUME   — N polygon vertices + depthFeet; value = area × depth / 27, in CY
//   COUNT    — each point is a stamp; value = number of stamps, in EA
//   RADIUS   — two points (center, edge); value = circumference, in LF
//
// All math lives in this file so the UI and the bid-line-push pipeline can
// agree on the value of a measurement to the cent.

import { z } from 'zod';

/** A 2-D point in plan-page coordinates (PDF user-space units, not pixels). */
export const PlanPointSchema = z.object({
  x: z.number(),
  y: z.number(),
});
export type PlanPoint = z.infer<typeof PlanPointSchema>;

/** The displayed unit of a measurement's realized value. */
export const PlanUnitSchema = z.enum([
  'LF', // linear feet — LENGTH, POLYLINE, RADIUS
  'SF', // square feet — AREA
  'CY', // cubic yards — VOLUME
  'EA', // each — COUNT
]);
export type PlanUnit = z.infer<typeof PlanUnitSchema>;

/** Real-world unit the user typed during scale calibration. */
export const ScaleUnitSchema = z.enum(['FT', 'IN', 'YD', 'M', 'CM']);
export type ScaleUnit = z.infer<typeof ScaleUnitSchema>;

/** Per-sheet scale calibration: two clicked points and the real distance. */
export const PlanScaleSchema = z.object({
  pointA: PlanPointSchema,
  pointB: PlanPointSchema,
  /** Real-world distance between A and B. */
  realDistance: z.number().positive(),
  realUnit: ScaleUnitSchema,
});
export type PlanScale = z.infer<typeof PlanScaleSchema>;

export const TakeoffMeasurementKindSchema = z.enum([
  'LENGTH',
  'AREA',
  'COUNT',
  'POLYLINE',
  'RADIUS',
  'VOLUME',
]);
export type TakeoffMeasurementKind = z.infer<typeof TakeoffMeasurementKindSchema>;

export const TakeoffMeasurementSchema = z.object({
  /** Local id within the takeoff — `m-<8hex>`. */
  id: z.string().min(1),
  kind: TakeoffMeasurementKindSchema,
  /** User-friendly label, shown on the page and in the takeoff list. */
  label: z.string().max(200).optional(),
  /** Bid item this measurement contributes to (for one-click push). */
  bidItemId: z.string().max(120).optional(),
  /** Cost code this measurement maps to. */
  costCodeId: z.string().max(120).optional(),
  /** Hex color used to draw the measurement on the page. */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** Layer name — free-form, used for show/hide toggles. */
  layer: z.string().max(120).optional(),
  /** Geometry — see file header for per-kind interpretation. */
  points: z.array(PlanPointSchema).default([]),
  /** Depth in real feet, only meaningful for VOLUME. */
  depthFeet: z.number().nonnegative().optional(),
  notes: z.string().max(2_000).optional(),
});
export type TakeoffMeasurement = z.infer<typeof TakeoffMeasurementSchema>;

export const PlanSheetTakeoffSchema = z.object({
  /** Sheet index in the PDF (0-based). */
  sheetIndex: z.number().int().nonnegative(),
  /** Optional sheet label / title-block name (e.g. "C-2.0"). */
  sheetLabel: z.string().max(120).optional(),
  scale: PlanScaleSchema.optional(),
  measurements: z.array(TakeoffMeasurementSchema).default([]),
});
export type PlanSheetTakeoff = z.infer<typeof PlanSheetTakeoffSchema>;

export const PlanTakeoffSchema = z.object({
  /** Stable id `pt-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** The job this takeoff is for (optional — pre-award takeoffs may not yet have one). */
  jobId: z.string().max(120).optional(),
  /** The bid this takeoff is for. */
  bidId: z.string().max(120).optional(),

  /** Reference to the source PDF (documents.id, object key, or full URL). */
  planRef: z.string().min(1).max(800),
  /** Friendly name (e.g. "Sulphur Springs — Plan Set Rev 2"). */
  name: z.string().min(1).max(200),

  sheets: z.array(PlanSheetTakeoffSchema).default([]),

  notes: z.string().max(10_000).optional(),
});
export type PlanTakeoff = z.infer<typeof PlanTakeoffSchema>;

export const PlanTakeoffCreateSchema = PlanTakeoffSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  sheets: z.array(PlanSheetTakeoffSchema).optional(),
});
export type PlanTakeoffCreate = z.infer<typeof PlanTakeoffCreateSchema>;

export const PlanTakeoffPatchSchema = PlanTakeoffCreateSchema.partial();
export type PlanTakeoffPatch = z.infer<typeof PlanTakeoffPatchSchema>;

/** Short id generator — matches the project's `<prefix>-<8hex>` pattern. */
export function newPlanTakeoffId(): string {
  return 'pt-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

export function newPlanMeasurementId(): string {
  return 'm-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

// ---- Math helpers -----------------------------------------------------------

/** Euclidean distance between two points (input units, no scale applied). */
export function euclideanDistance(a: PlanPoint, b: PlanPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Shoelace area for a closed polygon (input units squared, no scale applied). */
export function shoelaceArea(points: PlanPoint[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** Sum of segment lengths for a polyline (input units, no scale applied). */
export function polylineLength(points: PlanPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    if (!p || !q) continue;
    total += euclideanDistance(p, q);
  }
  return total;
}

const TO_FT: Record<ScaleUnit, number> = {
  FT: 1,
  IN: 1 / 12,
  YD: 3,
  M: 3.28084,
  CM: 3.28084 / 100,
};

/** Real feet per 1 unit of plan-page coordinates, given a calibration. */
export function feetPerPlanUnit(scale: PlanScale): number {
  const dPlan = euclideanDistance(scale.pointA, scale.pointB);
  if (dPlan === 0) return 0;
  const realInFeet = scale.realDistance * TO_FT[scale.realUnit];
  return realInFeet / dPlan;
}

/** Convert a length in plan-page units to real feet. */
export function planLengthToFeet(planLength: number, scale: PlanScale): number {
  return planLength * feetPerPlanUnit(scale);
}

/** Convert a polygon area in (plan-page units)² to real square feet. */
export function planAreaToSquareFeet(planArea: number, scale: PlanScale): number {
  const ratio = feetPerPlanUnit(scale);
  return planArea * ratio * ratio;
}

/** Realized value of a measurement, in its natural display unit.
 *  Returns 0 if the calibration is missing (where one is needed) or the
 *  geometry is incomplete. */
export function measurementValue(
  m: Pick<TakeoffMeasurement, 'kind' | 'points' | 'depthFeet'>,
  scale: PlanScale | undefined,
): { value: number; unit: PlanUnit } {
  switch (m.kind) {
    case 'COUNT':
      return { value: m.points.length, unit: 'EA' };
    case 'LENGTH': {
      if (!scale || m.points.length < 2) return { value: 0, unit: 'LF' };
      const a = m.points[0];
      const b = m.points[1];
      if (!a || !b) return { value: 0, unit: 'LF' };
      return { value: planLengthToFeet(euclideanDistance(a, b), scale), unit: 'LF' };
    }
    case 'POLYLINE': {
      if (!scale) return { value: 0, unit: 'LF' };
      return { value: planLengthToFeet(polylineLength(m.points), scale), unit: 'LF' };
    }
    case 'RADIUS': {
      if (!scale || m.points.length < 2) return { value: 0, unit: 'LF' };
      const a = m.points[0];
      const b = m.points[1];
      if (!a || !b) return { value: 0, unit: 'LF' };
      const radius = euclideanDistance(a, b);
      return { value: planLengthToFeet(2 * Math.PI * radius, scale), unit: 'LF' };
    }
    case 'AREA': {
      if (!scale) return { value: 0, unit: 'SF' };
      return { value: planAreaToSquareFeet(shoelaceArea(m.points), scale), unit: 'SF' };
    }
    case 'VOLUME': {
      if (!scale) return { value: 0, unit: 'CY' };
      const sf = planAreaToSquareFeet(shoelaceArea(m.points), scale);
      const cf = sf * (m.depthFeet ?? 0);
      return { value: cf / 27, unit: 'CY' };
    }
  }
}

/** Default hex color per measurement kind — used when a measurement doesn't
 *  set its own. Chosen for outdoor-readable on a typical plan-set page. */
export function defaultMeasurementColor(kind: TakeoffMeasurementKind): string {
  switch (kind) {
    case 'LENGTH':
      return '#dc2626'; // red
    case 'POLYLINE':
      return '#ea580c'; // orange
    case 'RADIUS':
      return '#ca8a04'; // amber
    case 'AREA':
      return '#16a34a'; // green
    case 'VOLUME':
      return '#0f766e'; // teal
    case 'COUNT':
      return '#2563eb'; // blue
  }
}

/** Friendly label for a kind enum value (replaces underscores, lowercases). */
export function takeoffMeasurementKindLabel(kind: TakeoffMeasurementKind): string {
  return kind.replace(/_/g, ' ').toLowerCase();
}
