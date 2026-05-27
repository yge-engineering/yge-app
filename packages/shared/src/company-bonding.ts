// Company bonding profile.
//
// NOTE on overlap with master-profile.ts: this module's
// BondingProfile shape was added in bundle 2590; later I noticed
// `MasterProfileBondingSchema` in `./master-profile.ts` already
// covers the edit/persist shape (surety, agg/single capacity,
// agent contact, notes). The two are intentionally separate now:
//
//   - master-profile.ts owns the BIG editable shape (DB-backed,
//     form-filler path resolution, surety address, agentEmail,
//     agentPhone, classifications, etc.)
//   - this module owns the SMALL read-only shape used by the
//     view-only /settings/company page + the capacity math
//     helpers (bondingCapacityState, bondingFeasibilityForBid)
//
// When the DB-backed MasterProfile row is the source of truth,
// a small adapter will read from it and produce a BondingProfile
// for these helpers to consume. The helpers stay value-add even
// after the edit form ships.
//
// All monetary amounts are Int cents per the project convention.

import { z } from 'zod';

import type { Cents } from './money';

export const BondingProfileSchema = z.object({
  /** Surety carrier the bonds run through (e.g. "Liberty Mutual"). */
  suretyName: z.string().min(1).max(120),
  /** Surety agent firm (e.g. "Westland Insurance Brokers"). */
  agentName: z.string().max(120).optional(),
  /** Agent contact (name + phone, free-form). */
  agentContact: z.string().max(200).optional(),
  /** Aggregate bonded-work capacity, cents. */
  aggregateCapacityCents: z.number().int().nonnegative(),
  /** Single-project bonded-work capacity, cents. */
  singleProjectCapacityCents: z.number().int().nonnegative(),
  /** Current bonded work-on-hand, cents. Maintained by Brook;
   *  the bond-capacity tracker keeps it fresh. */
  currentBondedWorkOnHandCents: z.number().int().nonnegative(),
  /** ISO date the surety relationship is up for renewal. */
  renewalDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** A.M. Best rating of the surety (e.g. "A XV"). Falls into
   *  the bid form's surety-qualification box. */
  amBestRating: z.string().max(20).optional(),
  /** US Treasury Circular 570 listed surety? Many federal +
   *  state agencies require Treasury-listed sureties. */
  treasuryListed: z.boolean().optional(),
});

export type BondingProfile = z.infer<typeof BondingProfileSchema>;

export interface BondingCapacityState {
  /** How many cents of aggregate capacity remain available
   *  AFTER subtracting current bonded work-on-hand. */
  remainingAggregateCapacityCents: Cents;
  /** Percent of aggregate capacity already used (0..100). */
  utilizationPercent: number;
  /** Days until the surety relationship renews. Negative if
   *  past due. */
  daysUntilRenewal: number;
}

/** Compute live capacity state from a profile + today's date. */
export function bondingCapacityState(
  profile: BondingProfile,
  asOfDate: Date,
): BondingCapacityState {
  const remaining = Math.max(
    0,
    profile.aggregateCapacityCents - profile.currentBondedWorkOnHandCents,
  );
  const utilization =
    profile.aggregateCapacityCents > 0
      ? Math.min(
          100,
          Math.round(
            (profile.currentBondedWorkOnHandCents /
              profile.aggregateCapacityCents) *
              100,
          ),
        )
      : 0;

  const renewal = new Date(profile.renewalDate + 'T00:00:00Z');
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysUntilRenewal = Math.ceil(
    (renewal.getTime() - asOfDate.getTime()) / msPerDay,
  );

  return {
    remainingAggregateCapacityCents: remaining,
    utilizationPercent: utilization,
    daysUntilRenewal,
  };
}

/** Would this new bid push YGE past either single-project or
 *  aggregate bonded capacity? Returns the first reason a bid
 *  would be infeasible, or null when within all capacities. */
export function bondingFeasibilityForBid(
  profile: BondingProfile,
  bidAmountCents: Cents,
): string | null {
  if (bidAmountCents > profile.singleProjectCapacityCents) {
    return `Bid ${bidAmountCents}¢ exceeds single-project capacity ${profile.singleProjectCapacityCents}¢`;
  }
  const projectedWOH = profile.currentBondedWorkOnHandCents + bidAmountCents;
  if (projectedWOH > profile.aggregateCapacityCents) {
    return `Bid would push work-on-hand to ${projectedWOH}¢, over aggregate capacity ${profile.aggregateCapacityCents}¢`;
  }
  return null;
}
