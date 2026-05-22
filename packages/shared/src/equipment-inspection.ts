// Equipment inspection — pre-shift / periodic safety check of a piece of
// heavy equipment (excavator, dozer, truck, etc.).
//
// Backs the DOT / Cal-OSHA / YGE Equipment Maintenance Plan paper trail.
// Same per-row check pattern as SWPPP inspections so foremen recognize the
// flow: name the item, mark PASS / FAIL / NEEDS_ATTENTION / NOT_APPLICABLE,
// add notes. Failures (or a manual flag) put the equipment OUT_OF_SERVICE.
//
// What this catches that paper logs miss:
//   - 'Has the 320 been inspected today?'
//   - 'What's currently out of service?'
//   - 'When did we first flag the hydraulic leak on the dozer?'

import { z } from 'zod';

export const EquipmentInspectionTypeSchema = z.enum([
  'PRE_SHIFT',
  'DAILY',
  'WEEKLY',
  'MONTHLY',
  'ANNUAL',
  'POST_INCIDENT',
  'OTHER',
]);
export type EquipmentInspectionType = z.infer<typeof EquipmentInspectionTypeSchema>;

export const EquipmentInspectionCheckStatusSchema = z.enum([
  'PASS',
  'FAIL',
  'NEEDS_ATTENTION',
  'NOT_APPLICABLE',
]);
export type EquipmentInspectionCheckStatus = z.infer<
  typeof EquipmentInspectionCheckStatusSchema
>;

export const EquipmentInspectionCheckSchema = z.object({
  /** Free-form check item name. e.g. "Tires/tracks", "Hydraulics", "Brakes". */
  name: z.string().min(1).max(200),
  status: EquipmentInspectionCheckStatusSchema,
  /** Optional details for the check (especially when FAIL / NEEDS_ATTENTION). */
  notes: z.string().max(2_000).optional(),
});
export type EquipmentInspectionCheck = z.infer<typeof EquipmentInspectionCheckSchema>;

export const EquipmentInspectionSchema = z.object({
  /** Stable id `ei-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  /** Equipment record this inspection applies to (Equipment.id). */
  equipmentId: z.string().min(1).max(120),
  /** Optional job association — the job the equipment was on that day. */
  jobId: z.string().max(120).optional(),

  type: EquipmentInspectionTypeSchema.default('PRE_SHIFT'),
  /** Date of inspection (yyyy-mm-dd). */
  inspectedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  /** Time of inspection (HH:MM 24h). Optional but useful for pre-shift logs. */
  inspectedAt: z.string().regex(/^\d{2}:\d{2}$/).optional(),

  /** Inspector's name, denormalized for the paper trail. */
  inspectorName: z.string().min(1).max(120),
  /** Inspector's Employee id if known. */
  inspectorEmployeeId: z.string().max(60).optional(),

  /** Engine-hours reading at inspection time. */
  hoursReading: z.number().nonnegative().optional(),
  /** Odometer reading for vehicles. */
  mileageReading: z.number().int().nonnegative().optional(),

  /** Per-check pass/fail rows — the core of the inspection record. */
  checks: z.array(EquipmentInspectionCheckSchema).default([]),

  /** Free-form summary of defects found. */
  defects: z.string().max(4_000).optional(),
  /** What was done about them. */
  correctiveAction: z.string().max(4_000).optional(),

  /** Equipment placed out-of-service pending repair. */
  outOfService: z.boolean().default(false),
  /** Why it was OOS'd — printed on the tag-out notice. */
  outOfServiceReason: z.string().max(2_000).optional(),

  /** Optional photo references (object keys from the photos store). */
  photoRefs: z.array(z.string().max(800)).default([]),

  /** Signature line on paper records → captured as text. */
  signedBy: z.string().max(120).optional(),

  notes: z.string().max(10_000).optional(),
});
export type EquipmentInspection = z.infer<typeof EquipmentInspectionSchema>;

export const EquipmentInspectionCreateSchema = EquipmentInspectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  type: EquipmentInspectionTypeSchema.optional(),
  checks: z.array(EquipmentInspectionCheckSchema).optional(),
  outOfService: z.boolean().optional(),
  photoRefs: z.array(z.string().max(800)).optional(),
});
export type EquipmentInspectionCreate = z.infer<typeof EquipmentInspectionCreateSchema>;

export const EquipmentInspectionPatchSchema = EquipmentInspectionCreateSchema.partial();
export type EquipmentInspectionPatch = z.infer<typeof EquipmentInspectionPatchSchema>;

/** Short id generator — matches the project's `<prefix>-<8hex>` pattern. */
export function newEquipmentInspectionId(): string {
  return 'ei-' + Math.random().toString(36).slice(2, 10).padEnd(8, '0');
}

/** Number of checks that need attention (FAIL or NEEDS_ATTENTION). */
export function equipmentInspectionDeficiencyCount(
  inspection: Pick<EquipmentInspection, 'checks'>,
): number {
  return inspection.checks.filter(
    (c) => c.status === 'FAIL' || c.status === 'NEEDS_ATTENTION',
  ).length;
}

/** True if the inspection found ANY problem — failures or the manual OOS flag. */
export function equipmentInspectionHasIssues(
  inspection: Pick<EquipmentInspection, 'checks' | 'outOfService'>,
): boolean {
  return inspection.outOfService || equipmentInspectionDeficiencyCount(inspection) > 0;
}

/** Friendly label for the inspection type enum (replaces underscores). */
export function equipmentInspectionTypeLabel(t: EquipmentInspectionType): string {
  return t.replace(/_/g, ' ').toLowerCase();
}
