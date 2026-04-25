// Subcontractor bid + CA Public Contract Code §4104 listing math.
//
// Why this lives in shared: the API uses it to validate updates, and the UI
// uses it to highlight which subs MUST be listed (red flag) vs which are
// optional. Same numbers in both places — the prime never gets surprised at
// bid open by a sub that should have been listed.
//
// The legal background, as plainly as we can say it:
//
//   PCC §4104 says: when a prime bids any California public works job, every
//   subcontractor that will perform work valued at more than a threshold
//   dollar amount must be listed on the bid form, with name + address +
//   CSLB license number + DIR registration + portion of work + dollar
//   amount. If the prime forgets to list a required sub, the bid is non-
//   responsive — the agency throws it out.
//
// Threshold:
//
//   - Streets, highways, bridges: max(0.5% of total bid, $10,000)
//   - Everything else (buildings, schools, etc.): 0.5% of total bid
//
// We treat ROAD_RECONSTRUCTION, BRIDGE, DRAINAGE, and GRADING as the
// streets/highways/bridges bucket (drainage and grading on a road project
// are improvements to a street). FIRE_FUEL_REDUCTION and OTHER fall to the
// plain 0.5% rule.

import { z } from 'zod';
import type { Cents } from './money';
import type { PtoEProjectType } from './plans-to-estimate-output';

/** Dollar threshold below which §4104 highway-floor stops applying. */
export const PCC_4104_HIGHWAY_FLOOR_CENTS: Cents = 10_000_00; // $10,000.00

export const SubBidSchema = z.object({
  /** Stable id within an estimate. Lets the editor reorder rows without
   *  losing track of which row the user just edited. */
  id: z.string().min(1).max(60),
  /** Legal or DBA name, as registered with CSLB. */
  contractorName: z.string().min(1).max(200),
  /** Single-line address. Printed as-is on the bid form. Optional in the
   *  UI so the estimator can paste a name first and fill in details after. */
  address: z.string().max(300).optional(),
  /** CSLB license number. §4104(a)(2). */
  cslbLicense: z.string().max(40).optional(),
  /** DIR public-works contractor registration. §4104(a)(3) — required for
   *  every PW job. We don't enforce here so the UI can stage incomplete
   *  rows; a downstream validator flags any missing values pre-submit. */
  dirRegistration: z.string().max(40).optional(),
  /** Plain English description of the work this sub will perform. */
  portionOfWork: z.string().min(1).max(500),
  /** Sub's bid amount in cents. §4104(a)(1) ties listing threshold to this. */
  bidAmountCents: z.number().int().nonnegative(),
  /** Internal-only notes — not printed on the bid. */
  notes: z.string().max(1_000).optional(),
});
export type SubBid = z.infer<typeof SubBidSchema>;

/**
 * Returns true for project types that are "construction of streets,
 * highways, or bridges" under §4104(a)(1)(B), and therefore get the
 * $10,000 floor.
 */
export function isHighwayClassProjectType(t: PtoEProjectType): boolean {
  return (
    t === 'ROAD_RECONSTRUCTION' ||
    t === 'BRIDGE' ||
    t === 'DRAINAGE' ||
    t === 'GRADING'
  );
}

/**
 * The §4104 listing threshold in cents. A sub whose work is **strictly
 * greater** than this dollar amount must be listed on the bid. (Equal-to
 * is the boundary; the statute says "in excess of", so the sub at exactly
 * the threshold doesn't need listing — but the editor surfaces those as
 * "borderline" so the estimator can decide.)
 */
export function pcc4104ThresholdCents(
  bidTotalCents: Cents,
  projectType: PtoEProjectType,
): Cents {
  const halfPercent = Math.round(bidTotalCents * 0.005);
  if (isHighwayClassProjectType(projectType)) {
    return Math.max(halfPercent, PCC_4104_HIGHWAY_FLOOR_CENTS);
  }
  return halfPercent;
}

export interface SubBidClassification {
  /** Cents threshold that applied to this estimate. */
  thresholdCents: Cents;
  /** True if the highway/$10K floor was the binding term. */
  highwayFloor: boolean;
  /** Subs the prime MUST list — bid > threshold. */
  mustList: SubBid[];
  /** Subs within $1,000 of the threshold (above or below). Estimator
   *  judgment call territory — surfaced as a yellow flag. */
  borderline: SubBid[];
  /** Subs the prime can leave off the listing. */
  optional: SubBid[];
  /** Sum of every sub's bid amount in cents. Used to sanity-check vs the
   *  estimate's bid total — total subs > total bid means a data entry bug. */
  totalSubCents: Cents;
}

const BORDERLINE_BAND_CENTS: Cents = 1_000_00; // $1,000

export function classifySubBids(
  subs: readonly SubBid[],
  bidTotalCents: Cents,
  projectType: PtoEProjectType,
): SubBidClassification {
  const thresholdCents = pcc4104ThresholdCents(bidTotalCents, projectType);
  const highwayFloor =
    isHighwayClassProjectType(projectType) &&
    Math.round(bidTotalCents * 0.005) < PCC_4104_HIGHWAY_FLOOR_CENTS;

  const mustList: SubBid[] = [];
  const borderline: SubBid[] = [];
  const optional: SubBid[] = [];
  let totalSubCents = 0;

  for (const s of subs) {
    totalSubCents += s.bidAmountCents;
    const distance = Math.abs(s.bidAmountCents - thresholdCents);
    if (s.bidAmountCents > thresholdCents) {
      if (distance <= BORDERLINE_BAND_CENTS) borderline.push(s);
      else mustList.push(s);
    } else {
      if (distance <= BORDERLINE_BAND_CENTS) borderline.push(s);
      else optional.push(s);
    }
  }
  return { thresholdCents, highwayFloor, mustList, borderline, optional, totalSubCents };
}

/** Compact id generator — safe for use as a React key + URL segment. */
export function newSubBidId(): string {
  // 8 lowercase hex chars is plenty unique within a single estimate.
  // Math.random is fine here — these never need cryptographic guarantees.
  const hex = Math.floor(Math.random() * 0x100000000).toString(16);
  return `sub-${hex.padStart(8, '0')}`;
}
