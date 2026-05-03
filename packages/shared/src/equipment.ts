// Equipment — heavy iron + on-road vehicles YGE owns or operates.
//
// Phase 1 scope:
//   - inventory + identification (name, category, make/model/year, VIN,
//     serial #, plate #, DOT #)
//   - usage tracking: each unit reports either HOURS or MILES, picked at
//     creation by usageMetric.
//   - maintenance: lastServiceUsage + serviceIntervalUsage drive a
//     computed nextServiceDueUsage and an isServiceDue boolean.
//   - assignment: assignedJobId + assignedOperatorEmployeeId so the
//     dispatcher can see "what equipment is on which job" in one query.
//   - log: an array of MaintenanceLogEntry rows (date + usage at service +
//     type + cost + notes). The log is the audit trail for the warranty
//     and the eventual resale value of the unit.
//
// Out of scope (Phase 4 deep equipment-tracking):
//   - GPS / telematics live position
//   - photos / spec-sheet PDFs
//   - DOT certificate-of-vehicle-inspection PDFs
//   - fuel + idle / non-idle hour split
//   - rental-rate book and inter-job billing

import { z } from 'zod';
import { translate, SEED_DICTIONARY, type Locale } from './i18n';

/** What kind of unit? Drives the field set surfaced in the editor and
 *  the category groups in the list view. SUPPORT covers water trucks,
 *  sweepers, lighting plants, light towers — things that don't fit in
 *  the heavy-equipment buckets but still need to be tracked. */
export const EquipmentCategorySchema = z.enum([
  'TRUCK',           // dump, flatbed, service body, pickup
  'TRAILER',         // lowboy, equipment trailer, dump trailer
  'DOZER',
  'EXCAVATOR',
  'LOADER',
  'BACKHOE',
  'GRADER',
  'ROLLER',
  'PAVER',
  'COMPACTOR_LARGE', // ride-on; small wackers + jumping jacks live in tools
  'WATER_TRUCK',
  'SWEEPER',
  'GENERATOR_LARGE', // towable / stationary; portable in tools
  'SUPPORT',         // catch-all for service body, lighting plant, etc.
  'OTHER',
]);
export type EquipmentCategory = z.infer<typeof EquipmentCategorySchema>;

/** Whether the unit is tracked by engine HOURS or odometer MILES. Most
 *  heavy iron is HOURS; on-road trucks + trailers are MILES. The user
 *  picks at creation; can be changed later if a unit was misclassified. */
export const EquipmentUsageMetricSchema = z.enum(['HOURS', 'MILES']);
export type EquipmentUsageMetric = z.infer<typeof EquipmentUsageMetricSchema>;

export const EquipmentStatusSchema = z.enum([
  'IN_YARD',
  'ASSIGNED',          // out on a job
  'IN_SERVICE',        // at the shop / undergoing scheduled service
  'OUT_FOR_REPAIR',    // unscheduled break-down repair
  'RETIRED',
  'SOLD',
]);
export type EquipmentStatus = z.infer<typeof EquipmentStatusSchema>;

/** What kind of work was done on this maintenance log entry? Keep
 *  granular enough to drive parts-cost rollups later. */
export const MaintenanceKindSchema = z.enum([
  'OIL_CHANGE',
  'FILTER',                // air, fuel, hydraulic, cabin
  'TIRE',
  'BRAKE',
  'HYDRAULIC',
  'ELECTRICAL',
  'COOLING',               // radiator, hoses, belts
  'TRANSMISSION',
  'ENGINE_MAJOR',
  'INSPECTION',            // BIT, annual, county weight
  'BREAKDOWN_REPAIR',
  'OTHER',
]);
export type MaintenanceKind = z.infer<typeof MaintenanceKindSchema>;

export const MaintenanceLogEntrySchema = z.object({
  /** ISO timestamp the work was completed. */
  performedAt: z.string(),
  /** Usage on the unit at service time (hours or miles, matches the
   *  parent equipment's usageMetric). */
  usageAtService: z.number().int().nonnegative(),
  kind: MaintenanceKindSchema,
  /** Free-form description of work performed. */
  description: z.string().min(1).max(2_000),
  /** Cost in cents. Optional because some work is in-house labor only. */
  costCents: z.number().int().nonnegative().optional(),
  /** Vendor / mechanic / shop name. Free-form. */
  performedBy: z.string().max(120).optional(),
});
export type MaintenanceLogEntry = z.infer<typeof MaintenanceLogEntrySchema>;

export const EquipmentSchema = z.object({
  /** Stable id of the form `eq-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Display name. e.g. "F-450 Service Truck", "Cat D6T". */
  name: z.string().min(1).max(120),
  category: EquipmentCategorySchema,
  make: z.string().max(80).optional(),
  model: z.string().max(80).optional(),
  /** Model year. */
  year: z.number().int().min(1900).max(2100).optional(),
  /** Vehicle Identification Number — required for TRUCK + TRAILER,
   *  optional for everything else. Validation isn't full VIN-checksum,
   *  just length-bound. */
  vin: z.string().max(40).optional(),
  /** Serial / PIN. Heavy equipment uses Product Identification Numbers
   *  rather than VINs. */
  serialNumber: z.string().max(80).optional(),
  /** YGE asset tag if you've stickered it. Free-form. */
  assetTag: z.string().max(60).optional(),
  /** License plate (TRUCK / TRAILER). Free-form so the user can add the
   *  state suffix ("CA 1ABC234"). */
  plateNumber: z.string().max(40).optional(),
  /** Per-unit DOT number when YGE's main DOT cert isn't enough (e.g.
   *  contracted unit). Falls back to YGE_COMPANY_INFO.dotNumber on
   *  printable forms when blank. */
  dotNumber: z.string().max(40).optional(),

  usageMetric: EquipmentUsageMetricSchema,
  /** Current odometer / hour-meter reading. Updated by the foreman daily
   *  on the daily report (future link); for now manually edited. */
  currentUsage: z.number().int().nonnegative().default(0),
  /** Reading at last service. Used to compute next-service-due. */
  lastServiceUsage: z.number().int().nonnegative().optional(),
  /** Service every N hours / miles. e.g. 250 hours for a dozer oil change,
   *  5000 miles for a truck. Optional for units with no scheduled
   *  maintenance (some trailers). */
  serviceIntervalUsage: z.number().int().positive().optional(),

  status: EquipmentStatusSchema.default('IN_YARD'),
  /** When status === 'ASSIGNED', the job this unit is on. */
  assignedJobId: z.string().max(120).optional(),
  /** When ASSIGNED, the operator. Many units have a default operator who
   *  always runs them — that goes here. */
  assignedOperatorEmployeeId: z.string().max(60).optional(),
  /** ISO timestamp when the current assignment started. */
  assignedAt: z.string().max(60).optional(),

  /** Maintenance audit trail. */
  maintenanceLog: z.array(MaintenanceLogEntrySchema).default([]),

  /** Free-form internal notes — not printed on dispatch sheets. */
  notes: z.string().max(4_000).optional(),
});
export type Equipment = z.infer<typeof EquipmentSchema>;

export const EquipmentCreateSchema = EquipmentSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  status: EquipmentStatusSchema.optional(),
  currentUsage: z.number().int().nonnegative().optional(),
  maintenanceLog: z.array(MaintenanceLogEntrySchema).optional(),
});
export type EquipmentCreate = z.infer<typeof EquipmentCreateSchema>;

export const EquipmentPatchSchema = EquipmentCreateSchema.partial();
export type EquipmentPatch = z.infer<typeof EquipmentPatchSchema>;

/** Body for `POST /api/equipment/:id/assign`. */
export const EquipmentAssignSchema = z.object({
  jobId: z.string().min(1).max(120),
  assignedOperatorEmployeeId: z.string().max(60).optional(),
});
export type EquipmentAssign = z.infer<typeof EquipmentAssignSchema>;

// ---- Display + service-math helpers --------------------------------------

export function equipmentCategoryLabel(c: EquipmentCategory, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `equipmentCategory.${c}`);
}

export function equipmentStatusLabel(s: EquipmentStatus, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `equipmentStatus.${s}`);
}

export function maintenanceKindLabel(k: MaintenanceKind, locale: Locale = 'en'): string {
  return translate(SEED_DICTIONARY, locale, `maintenanceKind.${k}`);
}

export function usageUnitLabel(metric: EquipmentUsageMetric): string {
  return metric === 'HOURS' ? 'hr' : 'mi';
}

export function formatUsage(eq: Pick<Equipment, 'currentUsage' | 'usageMetric'>): string {
  const unit = usageUnitLabel(eq.usageMetric);
  return `${eq.currentUsage.toLocaleString('en-US')} ${unit}`;
}

/** Computed reading at which this unit is next due for service. Returns
 *  undefined when the unit has no scheduled maintenance. */
export function nextServiceDueUsage(eq: Pick<Equipment, 'lastServiceUsage' | 'serviceIntervalUsage'>): number | undefined {
  if (eq.serviceIntervalUsage === undefined) return undefined;
  const last = eq.lastServiceUsage ?? 0;
  return last + eq.serviceIntervalUsage;
}

/** Hours/miles until the next scheduled service. Negative when overdue.
 *  Undefined when the unit has no scheduled maintenance. */
export function usageUntilService(eq: Pick<Equipment, 'currentUsage' | 'lastServiceUsage' | 'serviceIntervalUsage'>): number | undefined {
  const next = nextServiceDueUsage(eq);
  if (next === undefined) return undefined;
  return next - eq.currentUsage;
}

export type ServiceDueLevel = 'none' | 'ok' | 'warn' | 'overdue';

/** Urgency band for the service-due indicator. 'warn' triggers when we're
 *  within 10% of the interval; 'overdue' once we're past it. */
export function serviceDueLevel(eq: Pick<Equipment, 'currentUsage' | 'lastServiceUsage' | 'serviceIntervalUsage'>): ServiceDueLevel {
  const interval = eq.serviceIntervalUsage;
  if (interval === undefined) return 'none';
  const remaining = usageUntilService(eq);
  if (remaining === undefined) return 'none';
  if (remaining < 0) return 'overdue';
  if (remaining <= Math.max(1, Math.round(interval * 0.1))) return 'warn';
  return 'ok';
}

/** Whether the unit needs a sticker on the dispatch board today. */
export function isServiceDue(eq: Pick<Equipment, 'currentUsage' | 'lastServiceUsage' | 'serviceIntervalUsage'>): boolean {
  const lvl = serviceDueLevel(eq);
  return lvl === 'warn' || lvl === 'overdue';
}

/** Stable new-equipment id `eq-<8hex>`. */
export function newEquipmentId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `eq-${hex.padStart(8, '0')}`;
}
