// Submittal turnaround analytics.
//
// Plain English: when YGE sends a shop drawing or product-data
// submittal to the engineer, the spec usually says they have
// 10-14 working days to return it. In practice some engineers
// turn around in 3 days; others sit on packets for 6 weeks. After a
// year you've got historical data — this module rolls it up so
// the next submittal's response-due-date can be set realistically.
//
// Pure derivation. No persisted records.

import type { Submittal, SubmittalStatus } from './submittal';

export interface SubmittalTurnaroundReviewerRow {
  reviewer: string;
  closedCount: number;
  /** Approved + Approved-as-noted closures. */
  approvedCount: number;
  /** Revise-resubmit + Rejected closures. */
  reworkCount: number;
  /** Mean days from submittedAt to returnedAt (calendar days). */
  meanTurnaroundDays: number;
  /** Worst turnaround time observed. */
  maxTurnaroundDays: number;
  /** Best turnaround time observed. */
  minTurnaroundDays: number;
  /** approvedCount / closedCount. */
  firstPassApprovalRate: number;
}

export interface SubmittalTurnaroundReport {
  closedConsidered: number;
  byReviewer: SubmittalTurnaroundReviewerRow[];
  /** Mean turnaround days across the whole sample. */
  blendedMeanTurnaroundDays: number;
  /** Mean across the sample weighted by submittal count per
   *  reviewer (same as blended for this case — included for
   *  parallelism with other reports). */
  totalApproved: number;
  totalRework: number;
  blendedFirstPassApprovalRate: number;
}

export interface SubmittalTurnaroundInputs {
  submittals: Submittal[];
  /** Optional date range on submittedAt to bound the sample. */
  start?: string;
  end?: string;
}

/** Statuses we treat as "closed" for the purposes of measuring
 *  turnaround. WITHDRAWN is excluded — that's a YGE-side closure,
 *  doesn't reflect engineer behavior. */
const CLOSED_STATUSES: SubmittalStatus[] = [
  'APPROVED',
  'APPROVED_AS_NOTED',
  'REVISE_RESUBMIT',
  'REJECTED',
];

export function buildSubmittalTurnaround(
  inputs: SubmittalTurnaroundInputs,
): SubmittalTurnaroundReport {
  const { submittals, start, end } = inputs;

  const closed = submittals.filter((s) => {
    if (!CLOSED_STATUSES.includes(s.status)) return false;
    if (!s.submittedAt || !s.returnedAt) return false;
    if (start && s.submittedAt < start) return false;
    if (end && s.submittedAt > end) return false;
    return true;
  });

  type Bucket = {
    reviewer: string;
    count: number;
    approvedCount: number;
    reworkCount: number;
    sumDays: number;
    minDays: number;
    maxDays: number;
  };
  const byReviewer = new Map<string, Bucket>();

  let totalSumDays = 0;
  let totalApproved = 0;
  let totalRework = 0;

  for (const s of closed) {
    const days = Math.max(0, daysBetween(s.submittedAt!, s.returnedAt!));
    const reviewer = (s.submittedTo?.trim() || 'Unknown').toString();
    const b =
      byReviewer.get(reviewer) ??
      ({
        reviewer,
        count: 0,
        approvedCount: 0,
        reworkCount: 0,
        sumDays: 0,
        minDays: Number.POSITIVE_INFINITY,
        maxDays: 0,
      } as Bucket);
    b.count += 1;
    b.sumDays += days;
    if (days < b.minDays) b.minDays = days;
    if (days > b.maxDays) b.maxDays = days;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') {
      b.approvedCount += 1;
      totalApproved += 1;
    } else {
      b.reworkCount += 1;
      totalRework += 1;
    }
    byReviewer.set(reviewer, b);
    totalSumDays += days;
  }

  const rows: SubmittalTurnaroundReviewerRow[] = [];
  for (const [, b] of byReviewer) {
    rows.push({
      reviewer: b.reviewer,
      closedCount: b.count,
      approvedCount: b.approvedCount,
      reworkCount: b.reworkCount,
      meanTurnaroundDays: Math.round(b.sumDays / b.count),
      maxTurnaroundDays: b.maxDays,
      minTurnaroundDays:
        b.minDays === Number.POSITIVE_INFINITY ? 0 : b.minDays,
      firstPassApprovalRate:
        b.count === 0 ? 0 : b.approvedCount / b.count,
    });
  }

  // Slowest mean turnaround first (the engineers we should plan
  // around).
  rows.sort((a, b) => b.meanTurnaroundDays - a.meanTurnaroundDays);

  const totalCount = closed.length;
  return {
    closedConsidered: totalCount,
    byReviewer: rows,
    blendedMeanTurnaroundDays:
      totalCount === 0 ? 0 : Math.round(totalSumDays / totalCount),
    totalApproved,
    totalRework,
    blendedFirstPassApprovalRate:
      totalCount === 0 ? 0 : totalApproved / totalCount,
  };
}

function daysBetween(from: string, to: string): number {
  const f = Date.parse(`${from}T00:00:00Z`);
  const t = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.round((t - f) / (24 * 60 * 60 * 1000));
}
