// Structured output of the Plans-to-Estimate AI endpoint.
// What Claude returns when it reads a plan set / spec / RFP and drafts a bid.

import { z } from 'zod';

export const PtoEItemConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW']);
export type PtoEItemConfidence = z.infer<typeof PtoEItemConfidenceSchema>;

export const PtoEProjectTypeSchema = z.enum([
  'ROAD_RECONSTRUCTION',
  'DRAINAGE',
  'BRIDGE',
  'GRADING',
  'FIRE_FUEL_REDUCTION',
  'OTHER',
]);
export type PtoEProjectType = z.infer<typeof PtoEProjectTypeSchema>;

export const PtoEBidItemSchema = z.object({
  itemNumber: z.string().min(1).max(20),
  description: z.string().min(1).max(500),
  unit: z.string().min(1).max(20),
  quantity: z.number().nonnegative(),
  confidence: PtoEItemConfidenceSchema,
  notes: z.string().max(1000).optional(),
  pageReference: z.string().max(80).optional(),
  /** Market-priced unit cost in cents. Optional — present only when
   *  the model produced a price. All-in number that bakes labor +
   *  equipment + material + the project's markup unless flagged
   *  otherwise in priceSourceNote. Human estimator overrides on
   *  review. */
  estimatedUnitPriceCents: z.number().int().nonnegative().optional(),
  /** quantity × estimatedUnitPriceCents at output time. Cached so
   *  the UI doesn't have to recompute + so historical drafts keep
   *  the exact number the model produced. */
  estimatedLineTotalCents: z.number().int().nonnegative().optional(),
  /** Where the price came from: HIGH = local recent comparable on
   *  file; MEDIUM = California regional average; LOW = generic
   *  industry assumption. Drives the markup-vs-trust call on review. */
  priceSourceConfidence: PtoEItemConfidenceSchema.optional(),
  /** One-line rationale for the price ("CA Caltrans 2024-2026 avg
   *  for Class 2 base", "based on YGE 2024 won bid #14 for similar
   *  drain rock"). Forces the model to think before it numbers. */
  priceSourceNote: z.string().max(500).optional(),
});
export type PtoEBidItem = z.infer<typeof PtoEBidItemSchema>;

export const PtoEOutputSchema = z.object({
  projectName: z.string().min(1).max(200),
  projectType: PtoEProjectTypeSchema,
  location: z.string().max(200).optional(),
  ownerAgency: z.string().max(200).optional(),
  bidDueDate: z.string().max(40).optional(),
  prebidMeeting: z.string().max(1000).optional(),
  bidItems: z.array(PtoEBidItemSchema).min(1),
  /** Plain assumptions list. v1.3.0+: each entry MUST start with one
   *  of "[HIGH] " / "[MED] " / "[LOW] " so the UI can color-code by
   *  risk. Older drafts without the prefix are treated as MEDIUM. */
  assumptions: z.array(z.string().max(500)).default([]),
  /** Scope the document EXPLICITLY says the owner provides ("by
   *  Owner", "by SMUD", "OFM", "NIC", "furnished and installed by
   *  agency"). The AI is forbidden from inventing this list — items
   *  go here ONLY when the plans / spec literally say so. Prevents
   *  silent scope reductions that hide million-dollar gaps in the
   *  assumptions list. */
  ownerFurnishedItems: z.array(z.string().max(300)).default([]),
  questionsForEstimator: z.array(z.string().max(500)).default([]),
  overallConfidence: PtoEItemConfidenceSchema,
  /** Sum of estimatedLineTotalCents across bidItems, when prices
   *  exist. Optional — old drafts without prices keep returning
   *  undefined here. */
  estimatedBidTotalCents: z.number().int().nonnegative().optional(),
  /** AI's calendar-month duration estimate. Includes the permitting
   *  / inspection / mobilization tail and the LIVE-site multiplier
   *  when applicable — not just active construction days. Always
   *  DERIVED from production rates × quantities, never a project-
   *  type default. */
  estimatedDurationCalendarMonths: z.number().int().positive().max(120).optional(),
  /** Multi-line breakdown of how the schedule was derived: which
   *  production rates were applied to which quantities, what got
   *  multiplied for LIVE-site work, what calendar drag was added.
   *  Example: "Structural fill 1,200 CY @ 300 CY/day = 4 days.
   *  Conduit 2,400 LF @ 200 LF/day = 12 days. LIVE-site ×1.6 on
   *  conduit work near energized switchgear = 19 days. Mob + 3
   *  SMUD inspection holds + weather buffer = +6 weeks. Total ≈
   *  3.5 months." */
  scheduleNote: z.string().max(2000).optional(),
  /** Site condition the AI determined by reading the plans. Drives
   *  the production-rate multiplier + the schedule-too-short
   *  warning. UNKNOWN means the AI could not tell and the human
   *  must verify before bidding. */
  siteCondition: z
    .enum(['LIVE', 'GREENFIELD', 'PARTIAL_LIVE', 'UNKNOWN'])
    .optional(),
});
export type PtoEOutput = z.infer<typeof PtoEOutputSchema>;

/** Helper: sum line totals across items that have a price. Used by
 *  the AI service to fill estimatedBidTotalCents + by the UI to
 *  render the rollup. */
export function sumPtoEBidTotalCents(items: readonly PtoEBidItem[]): number {
  return items.reduce(
    (sum, item) => sum + (item.estimatedLineTotalCents ?? 0),
    0,
  );
}
