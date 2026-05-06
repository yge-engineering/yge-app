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
import { SubBidSchema } from './sub-bid';
import { BidSecuritySchema } from './bid-security';
import { AddendumSchema } from './addendum';

/** Crew-buildup line — labor, equipment, or material — that, when
 *  multiplied out across a bid item's quantity, justifies the unit
 *  price. Phase 1 keeps each list flat; per-line buildup nests under
 *  the bid item itself in `PricedBidItem.costBuildup`. */
export const CostBuildupLaborSchema = z.object({
  id: z.string().min(1).max(60),
  /** DIR / CSLB classification or plain text (e.g. "Operator
   *  Group 4", "Laborer", "Foreman"). */
  classification: z.string().max(120).default(''),
  /** Crew size. Fractional allowed for utility/sharing setups. */
  crewSize: z.number().nonnegative().default(0),
  /** Hours per unit if `perUnit` is true; otherwise total hours. */
  hours: z.number().nonnegative().default(0),
  /** Base hourly rate in cents. Excludes fringes — those go below. */
  hourlyRateCents: z.number().int().nonnegative().default(0),
  /** Per-hour fringes (health, retirement, training, etc.) in cents.
   *  CA prevailing-wage jobs typically split base + fringes. */
  fringeRateCents: z.number().int().nonnegative().default(0),
  /** True = hours and crewSize are per quantity unit (the whole line
   *  scales with `quantity` × `crewSize` × `hours`). False = lump
   *  sum (whole-line crewSize × hours regardless of quantity). */
  perUnit: z.boolean().default(false),
});
export type CostBuildupLabor = z.infer<typeof CostBuildupLaborSchema>;

export const CostBuildupEquipmentSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().max(120).default(''),
  hours: z.number().nonnegative().default(0),
  hourlyRateCents: z.number().int().nonnegative().default(0),
  perUnit: z.boolean().default(false),
});
export type CostBuildupEquipment = z.infer<typeof CostBuildupEquipmentSchema>;

export const CostBuildupMaterialSchema = z.object({
  id: z.string().min(1).max(60),
  name: z.string().max(120).default(''),
  /** Material quantity. perUnit=true → per quantity unit; false →
   *  lump sum for the whole line. */
  quantity: z.number().nonnegative().default(0),
  unitCostCents: z.number().int().nonnegative().default(0),
  perUnit: z.boolean().default(false),
});
export type CostBuildupMaterial = z.infer<typeof CostBuildupMaterialSchema>;

export const CostBuildupSchema = z.object({
  labor: z.array(CostBuildupLaborSchema).default([]),
  equipment: z.array(CostBuildupEquipmentSchema).default([]),
  materials: z.array(CostBuildupMaterialSchema).default([]),
  /** A flat sub-bid amount, e.g. when this line is fully subbed out
   *  and we just need the dollar number on the buildup. */
  subLumpSumCents: z.number().int().nonnegative().optional(),
  /** Free-form notes — assumptions, productivity reasoning, etc. */
  notes: z.string().max(500).optional(),
});
export type CostBuildup = z.infer<typeof CostBuildupSchema>;

/** A bid item with the estimator's unit price layered on. */
export const PricedBidItemSchema = PtoEBidItemSchema.extend({
  /** Cents per `unit`. null means the estimator hasn't priced it yet. */
  unitPriceCents: z.number().int().nonnegative().nullable(),
  /** Optional crew buildup. When present the editor surfaces a
   *  computed "calculated unit price" alongside the manual one and
   *  lets the estimator promote it. Older estimate files parse fine
   *  because the field is optional. */
  costBuildup: CostBuildupSchema.optional(),
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

  /** Subcontractors per CA PCC §4104. Optional + defaults to [] so older
   *  estimate JSON files on disk still parse. The classification helper in
   *  `sub-bid.ts` flags which of these MUST be listed at bid open. */
  subBids: z.array(SubBidSchema).default([]),

  /** Bid security that goes in the envelope on bid day. Optional because
   *  not every job requires it (private work, small task orders) and
   *  pre-feature files don't have it. The editor seeds a default 10% bid
   *  bond when the user opens the section for the first time. */
  bidSecurity: BidSecuritySchema.optional(),

  /** Addenda issued by the agency before bid open. Each one must be
   *  individually acknowledged on the bid form — un-acked addenda are
   *  the #1 cause of bids getting tossed at bid open. Defaults to []
   *  so older estimate JSON files on disk still parse. */
  addenda: z.array(AddendumSchema).default([]),

  /** Sub-bid leveling worksheet — per scope, multiple competing
   *  quotes with one Awarded as the winner. Persists the state from
   *  the /estimates/[id]/sub-leveling page so the work survives
   *  device switches. Defaults to []; older estimate JSON files
   *  parse fine. The Awarded entries can be promoted into subBids
   *  via a "Send to §4104" button (future bundle). */
  subLeveling: z
    .array(
      z.object({
        id: z.string().min(1).max(60),
        scope: z.string().max(200).default(''),
        awardedBidId: z.string().max(60).optional(),
        bids: z
          .array(
            z.object({
              id: z.string().min(1).max(60),
              contractorName: z.string().max(200).default(''),
              cslbLicense: z.string().max(40).default(''),
              bidAmountCents: z.number().int().nonnegative().default(0),
              notes: z.string().max(500).default(''),
            }),
          )
          .default([]),
      }),
    )
    .default([]),
});
export type PricedEstimate = z.infer<typeof PricedEstimateSchema>;
export type SubLevelingScope = PricedEstimate['subLeveling'][number];
export type SubLevelingBid = SubLevelingScope['bids'][number];

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

// ---- Crew buildup math --------------------------------------------------

/**
 * Total cost in cents for a single buildup, applied across the bid
 * item's `quantity`. Each labor/equipment/material line carries a
 * `perUnit` flag — if true, the cost scales with quantity (typical
 * for productivity-driven lines like "labor: 0.5 hr/CY"). If false,
 * it's a lump sum applied once for the whole bid item.
 */
export function totalBuildupCents(b: CostBuildup, quantity: number): Cents {
  let total = 0;
  for (const l of b.labor) {
    const perHour = l.hourlyRateCents + l.fringeRateCents;
    const hours = l.perUnit ? l.crewSize * l.hours * quantity : l.crewSize * l.hours;
    total += Math.round(hours * perHour);
  }
  for (const e of b.equipment) {
    const hours = e.perUnit ? e.hours * quantity : e.hours;
    total += Math.round(hours * e.hourlyRateCents);
  }
  for (const m of b.materials) {
    const qty = m.perUnit ? m.quantity * quantity : m.quantity;
    total += Math.round(qty * m.unitCostCents);
  }
  if (b.subLumpSumCents) total += b.subLumpSumCents;
  return total;
}

/** Calculated unit price = total buildup ÷ bid quantity. Null if
 *  quantity is 0 or negative (avoids divide-by-zero). */
export function buildupUnitPriceCents(
  b: CostBuildup,
  quantity: number,
): Cents | null {
  if (quantity <= 0) return null;
  return Math.round(totalBuildupCents(b, quantity) / quantity);
}
