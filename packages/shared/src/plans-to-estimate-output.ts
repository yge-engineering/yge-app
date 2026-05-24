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
  assumptions: z.array(z.string().max(500)).default([]),
  questionsForEstimator: z.array(z.string().max(500)).default([]),
  overallConfidence: PtoEItemConfidenceSchema,
  /** Sum of estimatedLineTotalCents across bidItems, when prices
   *  exist. Optional — old drafts without prices keep returning
   *  undefined here. */
  estimatedBidTotalCents: z.number().int().nonnegative().optional(),
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
