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
  /** Schedule grouping. CA agency bids commonly have Schedule A
   *  (base bid), Schedule B (additive), plus Alt 1, Alt 2, etc.
   *  Free-form string so the estimator can type whatever the bid
   *  form calls them. Empty / undefined means the line goes into
   *  the default group (rendered as the base bid). */
  schedule: z.string().max(80).optional(),
  /** True = the line is an alternate that doesn't roll into the
   *  base bid total but is summarized separately so the estimator
   *  can decide which alternates to submit. Phase 1 simple flag —
   *  per-alternate accept/reject states layer on later. */
  isAlternate: z.boolean().optional(),
  /** Estimator's review state for AI-drafted lines.
   *   - 'accepted'  — the estimator has eyeballed this line and is
   *                   happy with the AI's quantity / description.
   *   - 'flagged'   — needs another look (open question, weird
   *                   quantity, sub source unknown, etc.).
   *   - undefined   — not yet reviewed; the editor's "X unreviewed"
   *                   count includes this one. */
  reviewState: z.enum(['accepted', 'flagged']).optional(),
  /** Per-line markup % override. Decimal fraction (0.10 = 10%).
   *  When set, this line's contribution to the bid's O&P uses this
   *  value instead of the estimate-level oppPercent. Lets the
   *  estimator drop a subcontractor line to 10% while the rest of
   *  the bid stays at the standard 20%. Undefined = inherit. */
  markupPct: z.number().min(0).max(2).optional(),
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

  /** Decimal fraction. 0.20 = 20% on top of direct cost. The lump
   *  overhead-and-profit number; the markup-stack components below
   *  are separate so the estimator can break out burden, bonds,
   *  insurance, and contingency. */
  oppPercent: z.number().min(0).max(2),
  /** Free-form estimator notes — not the same as draft assumptions. */
  notes: z.string().max(5_000).optional(),

  /** Markup stack — flat percentages applied on top of direct cost
   *  before O&P. Heavy-civil bids typically split these out so the
   *  estimator and the bond/insurance broker can see each line. All
   *  decimal fractions (0.30 = 30%); the field is optional so older
   *  estimate files keep their previous bid total. */
  markup: z
    .object({
      /** Workers comp + payroll taxes + general liability on labor.
       *  Typically 30-50% of direct on prevailing-wage work. */
      laborBurdenPct: z.number().min(0).max(2).default(0),
      /** Fuel, maintenance, ownership cost on equipment. Typically
       *  10-25% of direct on equipment-heavy lines. */
      equipmentBurdenPct: z.number().min(0).max(2).default(0),
      /** Mark-up on subcontractor totals — usually 5-10% to cover
       *  bond + supervision. */
      subMarkupPct: z.number().min(0).max(2).default(0),
      /** Bid bond + payment/performance bond. Typically 1.5-3%. */
      bondPct: z.number().min(0).max(0.2).default(0),
      /** Builder's risk + general policy. Typically 0.5-1.5%. */
      insurancePct: z.number().min(0).max(0.2).default(0),
      /** Estimator's contingency — usually 0-5% on a tight bid. */
      contingencyPct: z.number().min(0).max(0.5).default(0),
    })
    .optional(),

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

  /** Per-unit price reference (e.g. per-acre, per-mile, per-SF).
   *  When set, the editor shows "$X / unit" next to the bid total,
   *  computed live as bidTotalCents / sizeValue. Used most often on
   *  fuel-reduction or grading work where the agency expects a
   *  per-acre price alongside the lump-sum bid. Optional — older
   *  estimate files parse fine. */
  perUnitPrice: z
    .object({
      /** Free-form unit label, e.g. "acre", "mile", "SF", "LF". */
      unit: z.string().min(1).max(40),
      /** Numeric size in `unit`s. 0 hides the per-unit display. */
      value: z.number().nonnegative(),
    })
    .optional(),

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

/** One row of the markup-stack breakdown — keeps the editor + math
 *  in sync. Each entry is the cents that this layer adds on top of
 *  direct cost. */
export interface MarkupStackBreakdown {
  laborBurdenCents: Cents;
  equipmentBurdenCents: Cents;
  subMarkupCents: Cents;
  bondCents: Cents;
  insuranceCents: Cents;
  contingencyCents: Cents;
  /** Total of all the rows above + the existing O&P. */
  oppCents: Cents;
}

export interface PricedEstimateTotals {
  /** Sum of every BASE-BID line's extended cents (zero for unpriced
   *  lines). Alternates are excluded — they sum into alternateCents
   *  separately so the prime can decide which alternates to submit. */
  directCents: Cents;
  /** Markup amount on the base bid only. Includes the legacy oppCents
   *  PLUS every entry in markupBreakdown. */
  oppCents: Cents;
  /** Per-component markup breakdown. The editor renders this so the
   *  estimator and the bond/insurance broker can read each line. */
  markupBreakdown: MarkupStackBreakdown;
  /** Base bid total: directCents + oppCents. */
  bidTotalCents: Cents;
  /** Sum of all alternate-line extended cents (no markup applied). */
  alternateCents: Cents;
  /** How many lines still have null unitPriceCents — the UI nags on > 0. */
  unpricedLineCount: number;
  /** Per-schedule subtotals. Key is the `schedule` string ('' for
   *  unschedule lines). Useful for printing Schedule A / B / C
   *  totals on the bid form without re-walking the array. */
  perSchedule: Record<string, Cents>;
}

export function computeEstimateTotals(est: PricedEstimate): PricedEstimateTotals {
  let directCents = 0;
  let alternateCents = 0;
  let unpricedLineCount = 0;
  // Per-line markup sum. When a bid item has its own markupPct set
  // we use it; otherwise the line inherits est.oppPercent. This lets
  // the estimator drop a subcontractor line to 10% while the rest
  // of the bid stays at the standard 20%.
  let perLineOppCents = 0;
  const perSchedule: Record<string, Cents> = {};
  for (const item of est.bidItems) {
    const lineCents = lineExtendedCents(item);
    if (item.isAlternate) {
      alternateCents += lineCents;
    } else {
      directCents += lineCents;
      const lineMarkup = item.markupPct ?? est.oppPercent;
      perLineOppCents += markupAmount(lineCents, lineMarkup);
    }
    if (item.unitPriceCents == null) unpricedLineCount += 1;
    const key = (item.schedule ?? '').trim();
    perSchedule[key] = (perSchedule[key] ?? 0) + lineCents;
  }
  // Markup stack — every component is flat on directCents. The legacy
  // oppPercent stays as the catch-all "O&P" row so existing estimate
  // files keep their previous bid total when markup.* are all zero.
  const m = est.markup;
  const burdenLabor = m?.laborBurdenPct ?? 0;
  const burdenEquip = m?.equipmentBurdenPct ?? 0;
  const subMarkup = m?.subMarkupPct ?? 0;
  const bond = m?.bondPct ?? 0;
  const insurance = m?.insurancePct ?? 0;
  const contingency = m?.contingencyPct ?? 0;
  const breakdown: MarkupStackBreakdown = {
    laborBurdenCents: markupAmount(directCents, burdenLabor),
    equipmentBurdenCents: markupAmount(directCents, burdenEquip),
    subMarkupCents: markupAmount(directCents, subMarkup),
    bondCents: markupAmount(directCents, bond),
    insuranceCents: markupAmount(directCents, insurance),
    contingencyCents: markupAmount(directCents, contingency),
    oppCents: perLineOppCents,
  };
  const oppCents =
    breakdown.laborBurdenCents +
    breakdown.equipmentBurdenCents +
    breakdown.subMarkupCents +
    breakdown.bondCents +
    breakdown.insuranceCents +
    breakdown.contingencyCents +
    breakdown.oppCents;
  return {
    directCents,
    oppCents,
    markupBreakdown: breakdown,
    bidTotalCents: directCents + oppCents,
    alternateCents,
    unpricedLineCount,
    perSchedule,
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
