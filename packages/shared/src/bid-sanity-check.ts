// Bid sanity check.
//
// Plain English: runs a set of "does this draft pass the smell test"
// rules against the AI's output and surfaces warnings the human
// estimator can act on BEFORE submitting. Born from a real-world miss:
// the AI priced a SMUD substation civil at $814K vs $3.1M actual,
// largely because it invented owner-furnishes scope ("transformers by
// SMUD" — nope, those are by contractor) AND defaulted to an 8–10
// week schedule for work that actually takes 5–6 months.
//
// Pure rule engine. No I/O. No AI. The rules encode YGE-learned
// heuristics so the AI's draft never goes to bid review without a
// gut-check pass.

import type { PtoEOutput, PtoEProjectType } from './plans-to-estimate-output';
import type { OwnerAgencyKind } from './owner-agency';

export type BidSanitySeverity = 'CRITICAL' | 'WARNING' | 'INFO';

export type BidSanityCategory =
  | 'OWNER_FURNISHES'
  | 'SCHEDULE'
  | 'BID_TOTAL'
  | 'EARTHWORK'
  | 'MARKUP'
  | 'PROMPT_VERSION'
  | 'OTHER';

export interface BidSanityFinding {
  /** Stable id so the UI can de-dup + the human can mark "ignored". */
  id: string;
  severity: BidSanitySeverity;
  category: BidSanityCategory;
  /** One-line plain-English summary for the chip. */
  title: string;
  /** Longer explanation + recommended action. */
  detail: string;
}

export interface BidSanityInput {
  draft: PtoEOutput;
  /** Owner-agency classification kind (from owner-agency module).
   *  Drives the utility-substation heuristics. Pass UNCLASSIFIED
   *  when the agency isn't known. */
  agencyKind?: OwnerAgencyKind;
  /** Optional override for the project's prompt version — the AI is
   *  on different rules depending on version. Older drafts may
   *  legitimately lack newer required fields. */
  promptVersion?: string;
}

/** Per-projectType minimum reasonable calendar-month duration.
 *  Anything below this fires a SCHEDULE warning. */
const MIN_REASONABLE_MONTHS: Record<PtoEProjectType, number> = {
  ROAD_RECONSTRUCTION: 2,
  DRAINAGE: 1,
  BRIDGE: 6,
  GRADING: 1,
  FIRE_FUEL_REDUCTION: 1,
  OTHER: 1,
};

/** When the owner is a CA utility, override the project-type
 *  minimum upward — substation / utility work is dominated by
 *  inspection-cycle drag, not project type. */
const UTILITY_AGENCY_MIN_MONTHS = 4;

/** Suspicious low-bid-total floors by project type, in cents. These
 *  are conservative — below this number, something is probably
 *  missing. Tuned to YGE's historical bid range; not a contract
 *  floor. */
const SUSPICIOUS_BID_FLOOR_CENTS: Record<PtoEProjectType, number> = {
  ROAD_RECONSTRUCTION: 75_000_00,
  DRAINAGE: 50_000_00,
  BRIDGE: 500_000_00,
  GRADING: 40_000_00,
  FIRE_FUEL_REDUCTION: 25_000_00,
  OTHER: 25_000_00,
};

/** Tokens that, when found in an `assumptions` string, indicate the
 *  AI is making an owner-furnishes claim — which is high-risk unless
 *  the item is also in `ownerFurnishedItems` (where it would only be
 *  if the AI quoted the source). */
const OWNER_FURNISHES_KEYWORDS = [
  'furnished by',
  'provided by',
  ' by owner',
  ' by smud',
  ' by pg&e',
  ' by caltrans',
  ' by ',  // catches "by City of Redding" / "by Shasta County" too
  'owner-furnished',
  'owner furnished',
  'ofm',
];

/** True when the agency kind is a California utility — drives the
 *  stricter duration / markup / OFM thresholds. */
function isUtilityAgency(kind: OwnerAgencyKind | undefined): boolean {
  return kind === 'MUNICIPAL_UTILITY';
}

/** Build a duration-warning finding when the AI's estimated duration
 *  looks unreasonably short for the project + agency combo. */
function checkSchedule(input: BidSanityInput): BidSanityFinding | null {
  const { draft, agencyKind } = input;
  const duration = draft.estimatedDurationCalendarMonths;
  if (duration == null) {
    return {
      id: 'schedule-missing',
      severity: 'WARNING',
      category: 'SCHEDULE',
      title: 'No schedule estimate',
      detail:
        'AI did not emit estimatedDurationCalendarMonths. Manually add a schedule estimate before bid review — the schedule drives mob, general conditions, and standby costs.',
    };
  }
  const minForType = MIN_REASONABLE_MONTHS[draft.projectType] ?? 1;
  const utilityMin = isUtilityAgency(agencyKind) ? UTILITY_AGENCY_MIN_MONTHS : 0;
  const min = Math.max(minForType, utilityMin);
  if (duration < min) {
    const why = isUtilityAgency(agencyKind)
      ? `Utility substation / facility work historically takes ${UTILITY_AGENCY_MIN_MONTHS}–6 months minimum once inspection holds + energization waits are baked in.`
      : `${draft.projectType.replace(/_/g, ' ').toLowerCase()} jobs typically need ≥ ${minForType} months from NTP to substantial completion.`;
    return {
      id: 'schedule-too-short',
      severity: 'CRITICAL',
      category: 'SCHEDULE',
      title: `Schedule looks short: ${duration} month${duration === 1 ? '' : 's'}`,
      detail: `${why} An under-estimated schedule undersizes general-conditions cost. Verify with the foreman + Brook before committing.`,
    };
  }
  return null;
}

/** Catch silent owner-furnishes assumptions — phrases like "X by
 *  SMUD" sitting in `assumptions` without a corresponding entry in
 *  `ownerFurnishedItems`. Those are the gaps that cost millions. */
function checkOwnerFurnishesHallucination(
  input: BidSanityInput,
): BidSanityFinding[] {
  const { draft } = input;
  const findings: BidSanityFinding[] = [];
  const ofItemsLower = new Set(
    draft.ownerFurnishedItems.map((s) => s.toLowerCase()),
  );
  draft.assumptions.forEach((a, idx) => {
    const lower = a.toLowerCase();
    const triggered = OWNER_FURNISHES_KEYWORDS.find((k) => lower.includes(k));
    if (!triggered) return;
    // Skip when this assumption text is mirrored in ownerFurnishedItems
    // (the AI properly cited the source).
    const mirrored = [...ofItemsLower].some(
      (it) => it.length > 12 && lower.includes(it.slice(0, 12)),
    );
    if (mirrored) return;
    findings.push({
      id: `owner-furnishes-${idx}`,
      severity: 'CRITICAL',
      category: 'OWNER_FURNISHES',
      title: 'Possible hallucinated owner-furnishes scope',
      detail: `Assumption claims something is owner-furnished ("${a.slice(0, 140)}") but the AI did not cite a source in ownerFurnishedItems. Verify the plans + spec literally say so. SMUD substation example: the contractor furnishes everything except the major switchgear skids — even when the AI confidently lists conduit / grounding as "by SMUD".`,
    });
  });
  return findings;
}

/** Heuristic floor on bid total — below this, something is missing. */
function checkBidTotal(input: BidSanityInput): BidSanityFinding | null {
  const { draft } = input;
  const total = draft.estimatedBidTotalCents;
  if (total == null || total === 0) {
    return {
      id: 'bid-total-missing',
      severity: 'INFO',
      category: 'BID_TOTAL',
      title: 'No grand total computed',
      detail:
        'AI emitted bid items without unit prices, so no grand total. Fill in prices on each line in the editor.',
    };
  }
  const floor = SUSPICIOUS_BID_FLOOR_CENTS[draft.projectType] ?? 25_000_00;
  if (total < floor) {
    return {
      id: 'bid-total-low',
      severity: 'WARNING',
      category: 'BID_TOTAL',
      title: 'Bid total below the typical floor for this project type',
      detail: `$${(total / 100).toLocaleString()} is below the YGE-tracked floor of $${(floor / 100).toLocaleString()} for ${draft.projectType.replace(/_/g, ' ').toLowerCase()} jobs. Verify nothing is missing.`,
    };
  }
  return null;
}

/** Earthwork should appear on any GRADING / ROAD project — a bid
 *  without one of those line items is almost certainly missing
 *  scope. */
function checkEarthwork(input: BidSanityInput): BidSanityFinding | null {
  const { draft } = input;
  if (
    draft.projectType !== 'GRADING' &&
    draft.projectType !== 'ROAD_RECONSTRUCTION'
  ) {
    return null;
  }
  const earthworkRe =
    /excavat|grad|cut|fill|import|export|scrape|strip|topsoil|borrow|compact|subgrade|aggregate base|class 2 ab|class ii base/i;
  const hasEarthwork = draft.bidItems.some(
    (i) => earthworkRe.test(i.description) || earthworkRe.test(i.notes ?? ''),
  );
  if (!hasEarthwork) {
    return {
      id: 'earthwork-missing',
      severity: 'CRITICAL',
      category: 'EARTHWORK',
      title: 'No earthwork bid items',
      detail: `Project type is ${draft.projectType.replace(/_/g, ' ')} but no excavation / grading / fill / scrape / aggregate items appear in the bid items. Either the plans really skip earthwork (rare for this type) or the AI missed the cross-sections. Walk the cut / fill sheets again.`,
    };
  }
  return null;
}

/** Run every rule against the draft + return all findings sorted by
 *  severity (CRITICAL > WARNING > INFO). */
export function runBidSanityCheck(input: BidSanityInput): BidSanityFinding[] {
  const out: BidSanityFinding[] = [];
  const schedule = checkSchedule(input);
  if (schedule) out.push(schedule);
  out.push(...checkOwnerFurnishesHallucination(input));
  const total = checkBidTotal(input);
  if (total) out.push(total);
  const earthwork = checkEarthwork(input);
  if (earthwork) out.push(earthwork);
  const order: Record<BidSanitySeverity, number> = {
    CRITICAL: 0,
    WARNING: 1,
    INFO: 2,
  };
  out.sort((a, b) => order[a.severity] - order[b.severity]);
  return out;
}

/** Convenience: split a v1.3.0 assumption string into {risk, text}.
 *  When no risk prefix exists, treats as MEDIUM. Used by the UI to
 *  color-code the assumptions list. */
export function parseAssumptionRisk(s: string): {
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  text: string;
} {
  const trimmed = s.trim();
  const match = trimmed.match(/^\[(HIGH|MED|LOW)\]\s+(.*)$/i);
  if (!match) {
    return { risk: 'MEDIUM', text: trimmed };
  }
  const tag = match[1]!.toUpperCase();
  const text = match[2]!;
  const risk: 'HIGH' | 'MEDIUM' | 'LOW' =
    tag === 'HIGH' ? 'HIGH' : tag === 'LOW' ? 'LOW' : 'MEDIUM';
  return { risk, text };
}
