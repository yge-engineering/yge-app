// Priced estimate — what an AI-drafted Plans-to-Estimate output becomes after
// the estimator has filled in unit prices. Phase 1 stand-in for the future
// Estimate / BidItem Postgres tables. Lives in shared so the API and the web
// app produce identical totals.
//
// Storage model:
//   - Each bid item carries a `unitPriceCents` (nullable; null = not yet
//     priced). We never store derived line totals or grand totals — they
//     compute fresh on read so a number can never drift from its inputs.
//   - O&P (overhead + profit) is a single percent on the whole bid for now.
//     Per-item or category-level O&P can layer on later without breaking
//     the on-disk shape.

import { z } from 'zod';
import type { Cents } from './money';
import { markupAmount } from './money';
import { PtoEBidItemSchema, PtoEProjectTypeSchema } from './plans-to-estimate-output';
import type { PtoEBidItem } from './plans-to-estimate-output';

/** A bid item with the estimator's unit price layered on. */
export const PricedBidItemSchema = PtoEBidItemSchema.extend({
  /** Cents per `unit`. null means the estimator hasn't priced it yet. */
  unitPriceCents: z.number().int().nonnegative().nullable(),
});
export type PricedBidItem = z.infer<typeof PricedBidItemSchema>;

export const PricedEstimateSchema = z.object({
  id: z.string().min(1),
  /** Saved-draft id this estimate was cloned from. Lets you walk back to the
   *  original AI run + RFP text. */
  fromDraftId: z.string().min(1),
  jobId: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),

  projectName: z.string().min(1).max(200),
  projectType: PtoEProjectTypeSchema,
  location: z.string().max(200).optional(),
  ownerAgency: z.string().max(200).optional(),
  bidDueDate: z.string().max(40).optional(),

  bidItems: z.array(PricedBidItemSchema).min(1),

  /** Decimal fraction. 0.20 = 20% on top of direct cost. */
  oppPercent: z.number().min(0).max(2),
  /** Free-form estimator notes — not the same as draft assumptions. */
  notes: z.string().max(5_000).optional(),
});
export type PricedEstimate = z.infer<typeof PricedEstimateSchema>;

// ---- Math ----------------------------------------------------------------

/**
 * Extended cents for a single line.
 *
 * `quantity` may be fractional (e.g. 0.25 acres). `unitPriceCents` is always
 * an integer. Multiplying floats and rounding once keeps us within cent
 * precision without dragging in a decimal library.
 */
export function lineExtendedCents(item: PricedBidItem): Cents {
  if (item.unitPriceCents == null) return 0;
  return Math.round(item.quantity * item.unitPriceCents);
}

export interface PricedEstimateTotals {
  /** Sum of every line's extended cents (zero for unpriced lines). */
  directCents: Cents;
  /** Markup amount = directCents * oppPercent, rounded. */
  oppCents: Cents;
  /** What the bid totals to: directCents + oppCents. */
  bidTotalCents: Cents;
  /** How many lines still have null unitPriceCents — the UI nags on > 0. */
  unpricedLineCount: number;
}

export function computeEstimateTotals(est: PricedEstimate): PricedEstimateTotals {
  let directCents = 0;
  let unpricedLineCount = 0;
  for (const item of est.bidItems) {
    directCents += lineExtendedCents(item);
    if (item.unitPriceCents == null) unpricedLineCount += 1;
  }
  const oppCents = markupAmount(directCents, est.oppPercent);
  return {
    directCents,
    oppCents,
    bidTotalCents: directCents + oppCents,
    unpricedLineCount,
  };
}

/** Build a fresh PricedEstimate from a saved draft's bid items. */
export function blankPricedItemsFromDraft(items: PtoEBidItem[]): PricedBidItem[] {
  return items.map((it) => ({ ...it, unitPriceCents: null }));
}
