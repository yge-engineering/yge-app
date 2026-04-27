// SWPPP / BMP inspection log.
//
// California's Construction General Permit (Order 2009-0009-DWQ as
// amended) requires the Qualified SWPPP Practitioner (QSP) to
// inspect Best Management Practices (BMPs) on a defined cadence:
//
//   - WEEKLY (minimum) during the rainy season
//   - 24 HOURS BEFORE each likely qualifying rain event (≥ 0.5"
//     forecast)
//   - DURING each qualifying rain event (every 24 hours while it's
//     actively raining and discharging)
//   - 48 HOURS AFTER each qualifying rain event ends
//
// The State Water Resources Control Board can audit + assess fines
// up to $10,000/day per violation. The inspection log is the
// document the inspector demands first.
//
// Phase 1 captures the data; Phase 2 will print the standard CGP
// inspection form.

import { z } from 'zod';

export const SwpppInspectionTriggerSchema = z.enum([
  'WEEKLY',
  'PRE_STORM',     // 24 hours before forecast event
  'DURING_STORM',
  'POST_STORM',    // within 48 hours after
  'NON_STORM_DISCHARGE',
  'OTHER',
]);
export type SwpppInspectionTrigger = z.infer<typeof SwpppInspectionTriggerSchema>;

export const BmpStatusSchema = z.enum([
  'OK',
  'MAINTENANCE_NEEDED',
  'FAILED',
  'NOT_INSTALLED',
  'NOT_APPLICABLE',
]);
export type BmpStatus = z.infer<typeof BmpStatusSchema>;

export const BmpCheckSchema = z.object({
  /** BMP name / identifier (e.g. "SE-1 Silt Fence", "TC-1 Stabilized
   *  Construction Entrance"). */
  bmpCode: z.string().min(1).max(40),
  bmpName: z.string().max(200),
  /** Optional location on the jobsite. */
  location: z.string().max(200).optional(),
  status: BmpStatusSchema.default('OK'),
  /** Free-form deficiency description, if any. */
  deficiency: z.string().max(1_000).optional(),
  /** Corrective action taken or planned. */
  correctiveAction: z.string().max(1_000).optional(),
  /** Date the corrective action was completed. (yyyy-mm-dd) */
  correctedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
  /** Photo refs. */
  photoRefs: z.array(z.string().max(400)).optional(),
});
export type BmpCheck = z.infer<typeof BmpCheckSchema>;

export const SwpppInspectionSchema = z.object({
  /** Stable id `swp-<8hex>`. */
  id: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  jobId: z.string().min(1).max(120),
  /** Date of inspection (yyyy-mm-dd). */
  inspectedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd'),
  trigger: SwpppInspectionTriggerSchema.default('WEEKLY'),

  /** Inspector name + QSP/QSD certification number. */
  inspectorName: z.string().min(1).max(120),
  inspectorCertification: z.string().max(40).optional(),

  /** Was rain forecast at time of inspection? */
  rainForecast: z.boolean().default(false),
  /** Forecast precip amount in hundredths of an inch. */
  forecastPrecipHundredths: z.number().int().nonnegative().optional(),
  /** Was a qualifying rain event observed? */
  qualifyingRainEvent: z.boolean().default(false),
  /** Total precip during this event, hundredths of inch. */
  observedPrecipHundredths: z.number().int().nonnegative().optional(),

  /** Was there a discharge from the site? */
  dischargeOccurred: z.boolean().default(false),
  /** Free-form discharge description. */
  dischargeDescription: z.string().max(1_000).optional(),

  bmpChecks: z.array(BmpCheckSchema).default([]),

  /** Free-form site notes. */
  notes: z.string().max(10_000).optional(),

  /** Date the inspection report was filed/finalized. */
  finalizedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use yyyy-mm-dd').optional(),
});
export type SwpppInspection = z.infer<typeof SwpppInspectionSchema>;

export const SwpppInspectionCreateSchema = SwpppInspectionSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  trigger: SwpppInspectionTriggerSchema.optional(),
  rainForecast: z.boolean().optional(),
  qualifyingRainEvent: z.boolean().optional(),
  dischargeOccurred: z.boolean().optional(),
  bmpChecks: z.array(BmpCheckSchema).optional(),
});
export type SwpppInspectionCreate = z.infer<typeof SwpppInspectionCreateSchema>;

export const SwpppInspectionPatchSchema = SwpppInspectionCreateSchema.partial();
export type SwpppInspectionPatch = z.infer<typeof SwpppInspectionPatchSchema>;

// ---- Helpers -------------------------------------------------------------

export function swpppTriggerLabel(t: SwpppInspectionTrigger): string {
  switch (t) {
    case 'WEEKLY': return 'Weekly';
    case 'PRE_STORM': return 'Pre-storm (24h before)';
    case 'DURING_STORM': return 'During storm';
    case 'POST_STORM': return 'Post-storm (48h after)';
    case 'NON_STORM_DISCHARGE': return 'Non-storm discharge';
    case 'OTHER': return 'Other';
  }
}

export function bmpStatusLabel(s: BmpStatus): string {
  switch (s) {
    case 'OK': return 'OK';
    case 'MAINTENANCE_NEEDED': return 'Maintenance needed';
    case 'FAILED': return 'Failed';
    case 'NOT_INSTALLED': return 'Not installed';
    case 'NOT_APPLICABLE': return 'N/A';
  }
}

/** Count BMPs that need attention (maintenance or failed). */
export function deficiencyCount(insp: Pick<SwpppInspection, 'bmpChecks'>): number {
  return insp.bmpChecks.filter(
    (b) => b.status === 'MAINTENANCE_NEEDED' || b.status === 'FAILED',
  ).length;
}

/** Open deficiencies — flagged in this inspection and not yet corrected. */
export function openDeficiencyCount(
  insp: Pick<SwpppInspection, 'bmpChecks'>,
): number {
  return insp.bmpChecks.filter(
    (b) =>
      (b.status === 'MAINTENANCE_NEEDED' || b.status === 'FAILED') && !b.correctedOn,
  ).length;
}

/**
 * Days since the most recent inspection of any kind. Used to flag
 * weekly-cadence violations during the rainy season.
 */
export function daysSinceLastInspection(
  inspections: SwpppInspection[],
  asOf: Date = new Date(),
): { days: number | null; lastDate: string | null } {
  if (inspections.length === 0) return { days: null, lastDate: null };
  const sorted = [...inspections]
    .map((i) => i.inspectedOn)
    .sort();
  const lastDate = sorted[sorted.length - 1] ?? null;
  if (!lastDate) return { days: null, lastDate: null };
  const last = new Date(lastDate + 'T00:00:00');
  const msPerDay = 24 * 60 * 60 * 1000;
  return {
    days: Math.max(0, Math.floor((asOf.getTime() - last.getTime()) / msPerDay)),
    lastDate,
  };
}

export interface SwpppRollup {
  total: number;
  /** Inspections that found at least one deficiency. */
  withDeficiencies: number;
  /** Total deficiencies still open across all inspections. */
  openDeficiencies: number;
  /** Days since last inspection. */
  daysSinceLast: number | null;
  lastInspectedOn: string | null;
  /** True if it has been > 7 days since the last inspection (weekly
   *  cadence violation under the CGP). */
  weeklyCadenceLate: boolean;
}

export function computeSwpppRollup(
  inspections: SwpppInspection[],
  asOf: Date = new Date(),
): SwpppRollup {
  let withDeficiencies = 0;
  let openDeficiencies = 0;
  for (const i of inspections) {
    const d = deficiencyCount(i);
    if (d > 0) withDeficiencies += 1;
    openDeficiencies += openDeficiencyCount(i);
  }
  const cadence = daysSinceLastInspection(inspections, asOf);
  return {
    total: inspections.length,
    withDeficiencies,
    openDeficiencies,
    daysSinceLast: cadence.days,
    lastInspectedOn: cadence.lastDate,
    weeklyCadenceLate: cadence.days != null && cadence.days > 7,
  };
}

export function newSwpppInspectionId(): string {
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `swp-${hex.padStart(8, '0')}`;
}
