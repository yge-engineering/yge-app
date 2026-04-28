// Per-month change-order origin breakdown.
//
// Plain English: bucket every change order by the month it was
// PROPOSED in, then group by reason (OWNER_DIRECTED,
// DIFFERING_SITE_CONDITION, RFI_RESPONSE, etc). Each row carries:
//   - count of COs in that month + reason
//   - dollar impact (only counted for APPROVED + EXECUTED status —
//     PROPOSED and AGENCY_REVIEW haven't been blessed yet)
//   - schedule impact in days
//
// Different angle than:
//   - co-density (COs per job)
//   - pco-vs-co-analysis (PCO → CO conversion)
//   - pco-origin-breakdown (PCO-only by reason)
//   - job-co-summary (per-job rollup)
//
// This shows the *trend* of CO activity — does February always
// have a DIFFERING_SITE_CONDITION spike? Are RFI_RESPONSE COs
// growing month over month? Useful for portfolio planning + the
// monthly safety / quality review.
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderReason } from './change-order';

export interface CoOriginMonthRow {
  /** yyyy-mm bucket. */
  month: string;
  reason: ChangeOrderReason;
  count: number;
  /** Sum of totalCostImpactCents on COs that are APPROVED or
   *  EXECUTED. PROPOSED + AGENCY_REVIEW + REJECTED + WITHDRAWN
   *  contribute zero. Negative values are deducts. */
  approvedDollarImpactCents: number;
  /** Total schedule impact in days (same APPROVED/EXECUTED filter). */
  approvedScheduleDays: number;
  /** Total count regardless of status — same as `count`, exposed
   *  separately because future versions may add a status filter. */
  totalCount: number;
}

export interface CoOriginMonthlyRollup {
  monthsConsidered: number;
  reasonsConsidered: number;
  totalCount: number;
  approvedTotalCents: number;
  approvedTotalScheduleDays: number;
  /** Reason with the highest count across the window. Null when no
   *  COs at all. */
  topReason: ChangeOrderReason | null;
  topReasonCount: number;
}

export interface CoOriginMonthlyInputs {
  changeOrders: ChangeOrder[];
  /** Inclusive yyyy-mm bounds (optional). */
  fromMonth?: string;
  toMonth?: string;
  /** Date field to bucket on — we use proposedAt by default since
   *  that's when the conversation started. Caller can pass
   *  'approvedAt' or 'executedAt' for a different lens. */
  dateField?: 'proposedAt' | 'approvedAt' | 'executedAt';
}

export function buildCoOriginMonthly(inputs: CoOriginMonthlyInputs): {
  rollup: CoOriginMonthlyRollup;
  rows: CoOriginMonthRow[];
} {
  const dateField = inputs.dateField ?? 'proposedAt';

  // Bucket by (month, reason).
  type Bucket = {
    month: string;
    reason: ChangeOrderReason;
    count: number;
    approvedDollar: number;
    approvedDays: number;
  };
  const key = (month: string, reason: ChangeOrderReason) => `${month}|${reason}`;
  const buckets = new Map<string, Bucket>();

  for (const co of inputs.changeOrders) {
    const dateStr = co[dateField];
    if (!dateStr) continue;
    const month = dateStr.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const k = key(month, co.reason);
    const b = buckets.get(k) ?? {
      month,
      reason: co.reason,
      count: 0,
      approvedDollar: 0,
      approvedDays: 0,
    };
    b.count += 1;
    if (co.status === 'APPROVED' || co.status === 'EXECUTED') {
      b.approvedDollar += co.totalCostImpactCents;
      b.approvedDays += co.totalScheduleImpactDays;
    }
    buckets.set(k, b);
  }

  const rows: CoOriginMonthRow[] = [];
  for (const b of buckets.values()) {
    rows.push({
      month: b.month,
      reason: b.reason,
      count: b.count,
      approvedDollarImpactCents: b.approvedDollar,
      approvedScheduleDays: b.approvedDays,
      totalCount: b.count,
    });
  }

  // Sort by month asc, then by reason asc — deterministic.
  rows.sort((a, b) => {
    if (a.month !== b.month) return a.month.localeCompare(b.month);
    return a.reason.localeCompare(b.reason);
  });

  // Rollup
  const monthsSet = new Set<string>();
  const reasonsSet = new Set<ChangeOrderReason>();
  let totalCount = 0;
  let approvedTotalCents = 0;
  let approvedTotalDays = 0;
  const reasonCounts = new Map<ChangeOrderReason, number>();
  for (const r of rows) {
    monthsSet.add(r.month);
    reasonsSet.add(r.reason);
    totalCount += r.count;
    approvedTotalCents += r.approvedDollarImpactCents;
    approvedTotalDays += r.approvedScheduleDays;
    reasonCounts.set(r.reason, (reasonCounts.get(r.reason) ?? 0) + r.count);
  }
  let topReason: ChangeOrderReason | null = null;
  let topReasonCount = 0;
  for (const [reason, count] of reasonCounts.entries()) {
    if (count > topReasonCount) {
      topReason = reason;
      topReasonCount = count;
    }
  }

  return {
    rollup: {
      monthsConsidered: monthsSet.size,
      reasonsConsidered: reasonsSet.size,
      totalCount,
      approvedTotalCents,
      approvedTotalScheduleDays: approvedTotalDays,
      topReason,
      topReasonCount,
    },
    rows,
  };
}
