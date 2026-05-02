// Bid coach — pre-submit sanity checks on a priced estimate.
//
// Plain English: before Ryan hits Send on a bid, the app runs a set
// of rules across the estimate, the agency's contract terms, YGE's
// historical pricing, and YGE's bonding capacity. Each rule that
// fires returns a flag — severity, category, plain-English message,
// optional pointer to the bid line that's the problem.
//
// What this catches in real life:
//
//   - Unit price 4x the median we charged for the same cost code
//     last year — typo in the rate cell, or a hasty markup pass that
//     blew past inflation
//   - The bid asks for a 10% bid bond, no bid security recorded yet
//     — bid is non-responsive at envelope open
//   - Addendum 3 was issued, never acknowledged on the bid form —
//     #1 reason public-works bids get tossed
//   - Bid total is $4.2M, remaining single-job bonding capacity is
//     $3.5M — surety can't write the performance bond, bid can't
//     close
//   - Bid is due 11:00 AM Tuesday, three line items still unpriced
//     at 9:30 AM — race against the clock UI nag
//
// Pure functions in / pure data out. The actual UI presentation, the
// dismissal-with-logged-note flow, and the AI-drafted suggestions
// layer (LLM-explained outliers, narrative gaps) live elsewhere.

import { z } from 'zod';
import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';

// ---- Severities + categories --------------------------------------------

export const BidCoachSeveritySchema = z.enum(['info', 'warn', 'danger']);
export type BidCoachSeverity = z.infer<typeof BidCoachSeveritySchema>;

export const BidCoachCategorySchema = z.enum([
  'PRICING',
  'CONTRACT',
  'BONDING',
  'DEADLINE',
  'SCOPE',
]);
export type BidCoachCategory = z.infer<typeof BidCoachCategorySchema>;

// ---- One flag -----------------------------------------------------------

export const BidCoachFlagSchema = z.object({
  /** Stable id per (estimate, ruleId, target). Same identity across
   *  re-runs so a dismissal sticks. */
  id: z.string().min(1).max(160),
  severity: BidCoachSeveritySchema,
  category: BidCoachCategorySchema,
  /** Stable rule key like 'pricing.unit-price-outlier-high'. Drives
   *  the dismissal log + the analytics 'what fires most often'. */
  ruleId: z.string().min(1).max(80),
  /** Headline shown in the flag list. */
  title: z.string().min(1).max(200),
  /** Longer plain-English explanation. The estimator should be able
   *  to read this once and decide. */
  message: z.string().min(1).max(2000),
  /** When the flag points at a specific bid-item, its refId so the
   *  UI can scroll to the row + highlight it. */
  bidItemRefId: z.string().max(120).optional(),
  /** When dismissed — UI only displays after this is set. */
  dismissedAt: z.string().optional(),
  dismissedReason: z.string().max(2000).optional(),
});
export type BidCoachFlag = z.infer<typeof BidCoachFlagSchema>;

// ---- Inputs -------------------------------------------------------------

/**
 * Historical unit-price stats. The caller — typically the API edge —
 * does the upstream matching from THIS bid's items to past awarded
 * bids' items (description fuzzy-match + same-unit), then passes the
 * resulting per-itemNumber stats in. Median / P25 / P75 / sample size
 * per item. The rule fires only when sampleSize >= the minimum.
 */
export interface HistoricalUnitPriceStats {
  /** Keyed by the THIS-bid item's itemNumber. */
  byItemNumber: Record<string, {
    medianCents: number;
    p25Cents: number;
    p75Cents: number;
    sampleSize: number;
  }>;
}

/**
 * Snapshot of the bonding capacity profile at run time.
 */
export interface BondingCapacity {
  /** Surety's per-job limit in cents. */
  singleJobLimitCents: number;
  /** Surety's aggregate limit across all open bonds in cents. */
  aggregateLimitCents: number;
  /** Total bonded value of jobs YGE currently has bonded out, in
   *  cents. The ratio (outstanding + this bid) / aggregate is what
   *  the surety reviews. */
  outstandingCents: number;
}

export interface BidCoachInputs {
  estimate: PricedEstimate;
  totals: PricedEstimateTotals;
  /** Awarded-history pricing — optional. Without it the outlier
   *  rule simply doesn't fire (rather than firing on no data and
   *  spitting noise). */
  history?: HistoricalUnitPriceStats;
  /** Bonding context — optional for private-work bids that don't
   *  require a bond. */
  bonding?: BondingCapacity;
  /** 'Now' for deadline math. Defaults to the current wall clock. */
  now?: Date;
  /** Flag ids the user has already dismissed on this estimate.
   *  Each rule's output is annotated with its dismissedAt instead
   *  of being filtered out — the binder still wants to show 'this
   *  was flagged + dismissed at 09:42'. */
  dismissals?: Map<string, { dismissedAt: string; reason: string }>;
}

// ---- Outlier thresholds (centralized for tunability) --------------------

/** Above this multiple of the historical median unit price the rule
 *  fires `warn`. Above 5x it fires `danger`. */
export const PRICING_OUTLIER_HIGH_WARN = 2.5;
export const PRICING_OUTLIER_HIGH_DANGER = 5;
/** Below this fraction of the historical median fires `warn`.
 *  Below 25% fires `danger`. */
export const PRICING_OUTLIER_LOW_WARN = 0.5;
export const PRICING_OUTLIER_LOW_DANGER = 0.25;
/** Minimum historical sample size required before the outlier rule
 *  is allowed to fire. */
export const PRICING_OUTLIER_MIN_SAMPLES = 5;

/** Bonding usage above this fraction (post-bid) fires `warn`; above
 *  100% fires `danger` (bid is unbondable as-is). */
export const BONDING_AGGREGATE_WARN_PCT = 0.85;
/** Single-job ratio thresholds. Same shape as aggregate. */
export const BONDING_SINGLE_JOB_WARN_PCT = 0.85;

/** Deadline thresholds (ms before bid open). */
export const DEADLINE_72H_MS = 72 * 60 * 60 * 1000;
export const DEADLINE_24H_MS = 24 * 60 * 60 * 1000;

// ---- Rules --------------------------------------------------------------

/**
 * Unpriced lines remaining. Always fires `danger` when any line has
 * no unit price — the bid math is broken until they're filled in.
 * Fires `info` (already correct) when the count is zero.
 */
export function ruleUnpricedLines(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate, totals } = inputs;
  if (totals.unpricedLineCount === 0) return [];
  return [{
    id: `${estimate.id}/pricing.unpriced-lines`,
    severity: 'danger',
    category: 'PRICING',
    ruleId: 'pricing.unpriced-lines',
    title: `${totals.unpricedLineCount} bid item${totals.unpricedLineCount === 1 ? '' : 's'} still unpriced`,
    message:
      'Lines with no unit price are silently zero in the bid total. Either fill in a unit price or delete the line before submitting.',
  }];
}

/**
 * Unit-price outliers vs. YGE's awarded-bid history. Skips silently
 * when no history is available or the bucket for this itemNumber has
 * fewer than PRICING_OUTLIER_MIN_SAMPLES.
 */
export function ruleUnitPriceOutliers(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate, history } = inputs;
  if (!history) return [];
  const flags: BidCoachFlag[] = [];
  for (const item of estimate.bidItems) {
    if (item.unitPriceCents == null) continue;
    const stats = history.byItemNumber[item.itemNumber];
    if (!stats || stats.sampleSize < PRICING_OUTLIER_MIN_SAMPLES) continue;
    if (stats.medianCents <= 0) continue;
    const ratio = item.unitPriceCents / stats.medianCents;
    let severity: BidCoachSeverity | null = null;
    let direction: 'high' | 'low' = 'high';
    if (ratio >= PRICING_OUTLIER_HIGH_DANGER) { severity = 'danger'; direction = 'high'; }
    else if (ratio >= PRICING_OUTLIER_HIGH_WARN) { severity = 'warn'; direction = 'high'; }
    else if (ratio <= PRICING_OUTLIER_LOW_DANGER) { severity = 'danger'; direction = 'low'; }
    else if (ratio <= PRICING_OUTLIER_LOW_WARN) { severity = 'warn'; direction = 'low'; }
    if (severity == null) continue;
    flags.push({
      id: `${estimate.id}/pricing.unit-price-outlier-${direction}/${item.itemNumber}`,
      severity,
      category: 'PRICING',
      ruleId: `pricing.unit-price-outlier-${direction}`,
      title: `${(ratio).toFixed(1)}x your historical median on item ${item.itemNumber}`,
      message:
        `Unit price ${formatCents(item.unitPriceCents)} on item ${item.itemNumber} ` +
        `(${item.description}) is ${direction === 'high' ? 'far above' : 'far below'} ` +
        `the median price you've bid for matching items on past awarded jobs ` +
        `(${formatCents(stats.medianCents)} over ${stats.sampleSize} past bids). ` +
        `Verify the rate is right before submitting.`,
      bidItemRefId: item.itemNumber,
    });
  }
  return flags;
}

/**
 * Addenda issued by the agency that haven't been acknowledged on the
 * estimate. An un-acked addendum makes the bid non-responsive at
 * envelope open.
 */
export function ruleUnackedAddenda(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate } = inputs;
  const unacked = estimate.addenda.filter((a) => !a.acknowledged);
  if (unacked.length === 0) return [];
  return unacked.map((a) => ({
    id: `${estimate.id}/contract.unacked-addendum/${a.id}`,
    severity: 'danger',
    category: 'CONTRACT',
    ruleId: 'contract.unacked-addendum',
    title: `Addendum ${a.number} not acknowledged`,
    message:
      `Addendum ${a.number}${a.subject ? ` (${a.subject})` : ''} ` +
      `${a.dateIssued ? `issued on ${a.dateIssued} ` : ''}has not been acknowledged. ` +
      `An un-acknowledged addendum is the #1 reason public-works bids get tossed ` +
      `at envelope open — every addendum must be checked off before submitting.`,
  }));
}

/**
 * Bid security missing on a job that asks for one. The agency's
 * IFB tells you what % bond is required; we surface the absence
 * here. Pass through silently when the estimate's bidSecurity is
 * present (the security record itself owns the deeper validity
 * checks).
 */
export function ruleMissingBidSecurity(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate, totals } = inputs;
  if (estimate.bidSecurity != null) return [];
  // Only public works typically requires bid security, but we don't
  // know agency requirements from the data model alone — use a
  // conservative trigger: any priced bid over $25k surfaces a `warn`.
  if (totals.bidTotalCents < 25_000_00) return [];
  return [{
    id: `${estimate.id}/contract.missing-bid-security`,
    severity: 'warn',
    category: 'CONTRACT',
    ruleId: 'contract.missing-bid-security',
    title: 'No bid security recorded',
    message:
      `No bid bond, cashier's check, or other bid security has been ` +
      `attached to this bid. Most public-works invitations require 10% ` +
      `bid security; bids missing it at envelope open are non-responsive. ` +
      `If the agency truly does not require security, dismiss this flag with a note.`,
  }];
}

/**
 * Bonding capacity check — does YGE have headroom to actually post
 * the performance bond on this job?
 */
export function ruleBondingCapacity(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate, totals, bonding } = inputs;
  if (!bonding) return [];
  const flags: BidCoachFlag[] = [];

  if (bonding.singleJobLimitCents > 0) {
    const singleRatio = totals.bidTotalCents / bonding.singleJobLimitCents;
    if (singleRatio > 1) {
      flags.push({
        id: `${estimate.id}/bonding.single-job-exceeded`,
        severity: 'danger',
        category: 'BONDING',
        ruleId: 'bonding.single-job-exceeded',
        title: `Bid total exceeds single-job bond limit`,
        message:
          `Bid total ${formatCents(totals.bidTotalCents)} exceeds your surety's ` +
          `single-job limit of ${formatCents(bonding.singleJobLimitCents)} by ` +
          `${formatCents(totals.bidTotalCents - bonding.singleJobLimitCents)}. ` +
          `Surety will not write the performance bond as bid — call your bonding ` +
          `agent before submitting.`,
      });
    } else if (singleRatio >= BONDING_SINGLE_JOB_WARN_PCT) {
      flags.push({
        id: `${estimate.id}/bonding.single-job-near-limit`,
        severity: 'warn',
        category: 'BONDING',
        ruleId: 'bonding.single-job-near-limit',
        title: `Bid uses ${(singleRatio * 100).toFixed(0)}% of single-job bond limit`,
        message:
          `Bid total ${formatCents(totals.bidTotalCents)} uses ${(singleRatio * 100).toFixed(0)}% ` +
          `of your surety's single-job limit (${formatCents(bonding.singleJobLimitCents)}). ` +
          `Confirm with the bonding agent that capacity is reserved before submit.`,
      });
    }
  }

  if (bonding.aggregateLimitCents > 0) {
    const projectedAggregate = bonding.outstandingCents + totals.bidTotalCents;
    const aggRatio = projectedAggregate / bonding.aggregateLimitCents;
    if (aggRatio > 1) {
      flags.push({
        id: `${estimate.id}/bonding.aggregate-exceeded`,
        severity: 'danger',
        category: 'BONDING',
        ruleId: 'bonding.aggregate-exceeded',
        title: `Aggregate bond capacity exceeded`,
        message:
          `Outstanding bonded backlog ${formatCents(bonding.outstandingCents)} plus this bid ` +
          `${formatCents(totals.bidTotalCents)} = ${formatCents(projectedAggregate)} — ` +
          `over your surety's aggregate limit of ${formatCents(bonding.aggregateLimitCents)}. ` +
          `Surety will not bond this job until existing work runs off the books.`,
      });
    } else if (aggRatio >= BONDING_AGGREGATE_WARN_PCT) {
      flags.push({
        id: `${estimate.id}/bonding.aggregate-near-limit`,
        severity: 'warn',
        category: 'BONDING',
        ruleId: 'bonding.aggregate-near-limit',
        title: `Aggregate bond usage projected at ${(aggRatio * 100).toFixed(0)}%`,
        message:
          `If this bid wins, aggregate bonded backlog projects to ${(aggRatio * 100).toFixed(0)}% ` +
          `of the ${formatCents(bonding.aggregateLimitCents)} surety limit. ` +
          `Aggregate usage above 85% triggers surety review on every new bond.`,
      });
    }
  }

  return flags;
}

/**
 * Bid-due deadline check.
 */
export function ruleDeadline(inputs: BidCoachInputs): BidCoachFlag[] {
  const { estimate, totals } = inputs;
  if (!estimate.bidDueDate) return [];
  const now = (inputs.now ?? new Date()).getTime();
  const due = parseDueDate(estimate.bidDueDate);
  if (due == null) return [];
  const remainingMs = due - now;

  if (remainingMs <= 0) {
    return [{
      id: `${estimate.id}/deadline.past-due`,
      severity: 'danger',
      category: 'DEADLINE',
      ruleId: 'deadline.past-due',
      title: 'Bid due date has already passed',
      message:
        `Bid due date ${estimate.bidDueDate} is in the past. Either the date is wrong or ` +
        `the bid is no longer accepting submissions. Update the date or move on.`,
    }];
  }

  if (remainingMs <= DEADLINE_24H_MS && totals.unpricedLineCount > 0) {
    return [{
      id: `${estimate.id}/deadline.race-against-clock`,
      severity: 'danger',
      category: 'DEADLINE',
      ruleId: 'deadline.race-against-clock',
      title: `Under 24 hours and ${totals.unpricedLineCount} line${totals.unpricedLineCount === 1 ? '' : 's'} unpriced`,
      message:
        `Bid is due within 24 hours and ${totals.unpricedLineCount} bid item${totals.unpricedLineCount === 1 ? '' : 's'} ` +
        `still need a unit price. Triage now or pull the bid.`,
    }];
  }

  if (remainingMs <= DEADLINE_72H_MS && totals.unpricedLineCount > 0) {
    return [{
      id: `${estimate.id}/deadline.tight`,
      severity: 'warn',
      category: 'DEADLINE',
      ruleId: 'deadline.tight',
      title: 'Under 72 hours with unpriced lines',
      message:
        `Bid is due within 72 hours and ${totals.unpricedLineCount} bid item${totals.unpricedLineCount === 1 ? '' : 's'} ` +
        `still need a unit price. Plan the rest of the pricing pass against the clock.`,
    }];
  }

  return [];
}

// ---- Runner -------------------------------------------------------------

const ALL_RULES = [
  ruleUnpricedLines,
  ruleUnitPriceOutliers,
  ruleUnackedAddenda,
  ruleMissingBidSecurity,
  ruleBondingCapacity,
  ruleDeadline,
] as const;

const SEVERITY_ORDER: Record<BidCoachSeverity, number> = {
  danger: 0,
  warn: 1,
  info: 2,
};

/**
 * Run every rule. Annotate dismissed flags with their dismissal
 * record (kept in the output, not filtered, so the binder shows
 * 'this fired + Ryan dismissed it because…').
 *
 * Sort: danger first, then warn, then info; within a severity,
 * stable order by ruleId then bidItemRefId.
 */
export function runBidCoach(inputs: BidCoachInputs): BidCoachFlag[] {
  const out: BidCoachFlag[] = [];
  for (const rule of ALL_RULES) {
    for (const flag of rule(inputs)) {
      const dismissal = inputs.dismissals?.get(flag.id);
      out.push(
        dismissal
          ? { ...flag, dismissedAt: dismissal.dismissedAt, dismissedReason: dismissal.reason }
          : flag,
      );
    }
  }
  out.sort((a, b) => {
    const sev = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sev !== 0) return sev;
    if (a.ruleId !== b.ruleId) return a.ruleId.localeCompare(b.ruleId);
    return (a.bidItemRefId ?? '').localeCompare(b.bidItemRefId ?? '');
  });
  return out;
}

export interface BidCoachReport {
  total: number;
  /** Active = not dismissed. */
  activeCount: number;
  /** Number of `danger`-severity active flags — UI gates Submit on this. */
  blockingCount: number;
  /** True iff every active flag is `info` (i.e. nothing is warn or
   *  danger). Drives the green 'looks good — submit?' state. */
  cleanToSubmit: boolean;
  bySeverity: Record<BidCoachSeverity, number>;
  byCategory: Record<BidCoachCategory, number>;
  flags: BidCoachFlag[];
}

export function summarizeBidCoach(flags: BidCoachFlag[]): BidCoachReport {
  const bySeverity: Record<BidCoachSeverity, number> = { info: 0, warn: 0, danger: 0 };
  const byCategory: Record<BidCoachCategory, number> = {
    PRICING: 0, CONTRACT: 0, BONDING: 0, DEADLINE: 0, SCOPE: 0,
  };
  let activeCount = 0;
  let blockingCount = 0;
  let anyActiveAboveInfo = false;
  for (const f of flags) {
    bySeverity[f.severity] += 1;
    byCategory[f.category] += 1;
    if (!f.dismissedAt) {
      activeCount += 1;
      if (f.severity === 'danger') blockingCount += 1;
      if (f.severity !== 'info') anyActiveAboveInfo = true;
    }
  }
  return {
    total: flags.length,
    activeCount,
    blockingCount,
    cleanToSubmit: !anyActiveAboveInfo,
    bySeverity,
    byCategory,
    flags,
  };
}

// ---- Helpers ------------------------------------------------------------

function formatCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Parse the estimate's bidDueDate into ms-since-epoch. Accepts ISO
 * timestamps and yyyy-mm-dd. yyyy-mm-dd is interpreted at 11:00:00
 * UTC, the most-common bid-open clock-time across CA agencies — this
 * is intentionally a default rather than a precise time, since the
 * data model only carries the date today. Returns null if unparsable.
 */
function parseDueDate(s: string): number | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return new Date(`${s}T11:00:00Z`).getTime();
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}
