// FMCSA §396.11 driver vehicle inspection report (DVIR).
//
// CDL drivers must complete a pre-trip and a post-trip inspection
// per duty day per power unit + trailer. The post-trip report is
// the legal one: if it shows a defect that would affect safe
// operation, the carrier must repair (or determine no repair is
// needed) before the next driver uses the vehicle.
//
// This module is the structured-data layer. Each inspection point
// from §396.11(c) gets a status + an optional note. Helpers compute
// safety-critical defect counts + a "ready to drive" verdict.
//
// Pure: no clock, no DB.

import { z } from 'zod';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const DotInspectionPointKindSchema = z.enum([
  'SERVICE_BRAKES',
  'PARKING_BRAKE',
  'STEERING_MECHANISM',
  'LIGHTS_REFLECTORS',
  'TIRES',
  'HORN',
  'WINDSHIELD_WIPERS',
  'MIRRORS',
  'COUPLING_DEVICES',
  'WHEELS_RIMS',
  'EMERGENCY_EQUIPMENT',
  'OTHER_DEFECTS',
]);
export type DotInspectionPointKind = z.infer<typeof DotInspectionPointKindSchema>;

/** Which §396.11(c) points are "safety-critical" — a defect at any
 *  one of these forces the vehicle off the road until repaired. */
export const SAFETY_CRITICAL_POINTS: ReadonlySet<DotInspectionPointKind> = new Set([
  'SERVICE_BRAKES',
  'PARKING_BRAKE',
  'STEERING_MECHANISM',
  'LIGHTS_REFLECTORS',
  'TIRES',
  'COUPLING_DEVICES',
  'WHEELS_RIMS',
]);

export const DotInspectionPointStatusSchema = z.enum([
  'OK',
  'DEFECT',
  'NOT_APPLICABLE',
]);
export type DotInspectionPointStatus = z.infer<typeof DotInspectionPointStatusSchema>;

export const DotInspectionPointSchema = z.object({
  kind: DotInspectionPointKindSchema,
  status: DotInspectionPointStatusSchema,
  note: z.string().max(2000).optional(),
});
export type DotInspectionPoint = z.infer<typeof DotInspectionPointSchema>;

export const DotInspectionKindSchema = z.enum(['PRE_TRIP', 'POST_TRIP']);
export type DotInspectionKind = z.infer<typeof DotInspectionKindSchema>;

export const DotInspectionReportSchema = z.object({
  id: z.string().min(1),
  /** Driver employee id. */
  driverId: z.string().min(1),
  driverName: z.string().min(1).max(200),
  /** Power-unit identifier (truck #). */
  powerUnit: z.string().min(1).max(120),
  /** Trailer id (or '' if none). */
  trailerId: z.string().max(120).optional(),
  /** Hub odometer at inspection time. */
  odometer: z.number().int().nonnegative().optional(),
  /** Date the inspection occurred (yyyy-mm-dd). */
  inspectionDate: z.string().regex(ISO_DATE, 'Use yyyy-mm-dd'),
  kind: DotInspectionKindSchema,
  points: z.array(DotInspectionPointSchema).default([]),
  /** Driver-signed certification text. */
  driverSignedAt: z.string().optional(),
  /** Mechanic / supervisor sign-off after repair. */
  mechanicNote: z.string().max(2000).optional(),
  mechanicSignedAt: z.string().optional(),
});
export type DotInspectionReport = z.infer<typeof DotInspectionReportSchema>;

export interface DotInspectionVerdict {
  defectCount: number;
  safetyCriticalDefectCount: number;
  /** True when the vehicle can drive — no safety-critical defects. */
  readyToDrive: boolean;
  /** True when the report requires a mechanic sign-off before next use. */
  requiresMechanicSignoff: boolean;
}

export function verdictFor(report: DotInspectionReport): DotInspectionVerdict {
  let total = 0;
  let critical = 0;
  for (const p of report.points) {
    if (p.status !== 'DEFECT') continue;
    total += 1;
    if (SAFETY_CRITICAL_POINTS.has(p.kind)) critical += 1;
  }
  return {
    defectCount: total,
    safetyCriticalDefectCount: critical,
    readyToDrive: critical === 0,
    requiresMechanicSignoff: total > 0,
  };
}

/** Empty checklist — every §396.11(c) point, status OK by default.
 *  Useful for "new pre-trip" forms. */
export function blankChecklist(): DotInspectionPoint[] {
  return DotInspectionPointKindSchema.options.map((kind) => ({
    kind,
    status: 'OK' as DotInspectionPointStatus,
  }));
}

/** Plain-English label for a point kind. */
export function pointLabel(kind: DotInspectionPointKind): string {
  return POINT_LABELS[kind];
}

const POINT_LABELS: Record<DotInspectionPointKind, string> = {
  SERVICE_BRAKES: 'Service brakes (incl. air lines)',
  PARKING_BRAKE: 'Parking brake',
  STEERING_MECHANISM: 'Steering mechanism',
  LIGHTS_REFLECTORS: 'Lighting devices + reflectors',
  TIRES: 'Tires',
  HORN: 'Horn',
  WINDSHIELD_WIPERS: 'Windshield wipers',
  MIRRORS: 'Rear-vision mirrors',
  COUPLING_DEVICES: 'Coupling devices',
  WHEELS_RIMS: 'Wheels + rims',
  EMERGENCY_EQUIPMENT: 'Emergency equipment',
  OTHER_DEFECTS: 'Other affecting safe operation',
};
