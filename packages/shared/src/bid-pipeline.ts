// Bid pursuit pipeline.
//
// Plain English: the estimating queue. Every priced estimate that's
// not yet awarded/lost/withdrawn is in pursuit. This rolls them up
// by bid-due-date urgency so Ryan + Brook can see what's hot, what's
// red-flag urgent, and what total $ value is sitting in the pipeline.
//
// Pure derivation. No persisted records.

import type { PricedEstimate } from './priced-estimate';
import { computeEstimateTotals } from './priced-estimate';

export type PursuitUrgency =
  | 'OVERDUE'  // bidDueDate has passed (we missed it or it's behind schedule)
  | 'TODAY'    // due today
  | 'THIS_WEEK'  // 1-7 days
  | 'NEXT_WEEK'  // 8-14 days
  | 'LATER'    // 15+ days
  | 'NO_DATE'; // no parseable bidDueDate

export interface BidPursuitRow {
  estimateId: string;
  jobId: string;
  projectName: string;
  ownerAgency?: string;
  bidDueDate?: string;
  bidTotalCents: number;
  /** Days from asOf to parsed bidDueDate. Negative = overdue. */
  daysToDue: number | null;
  urgency: PursuitUrgency;
}

export interface BidPursuitRollup {
  total: number;
  totalBidValueCents: number;
  byUrgency: Record<PursuitUrgency, number>;
  /** Total $ value in OVERDUE + TODAY + THIS_WEEK buckets. */
  hotPipelineCents: number;
}

export interface BidPursuitInputs {
  /** ISO yyyy-mm-dd; defaults to today (UTC). */
  asOf?: string;
  estimates: PricedEstimate[];
}

export function buildBidPursuitPipeline(
  inputs: BidPursuitInputs,
): { rows: BidPursuitRow[]; rollup: BidPursuitRollup } {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);

  const rows: BidPursuitRow[] = [];
  for (const e of inputs.estimates) {
    const totals = computeEstimateTotals(e);
    const daysToDue = parseDueOffsetDays(e.bidDueDate, asOf);
    const urgency: PursuitUrgency =
      daysToDue == null
        ? 'NO_DATE'
        : daysToDue < 0
          ? 'OVERDUE'
          : daysToDue === 0
            ? 'TODAY'
            : daysToDue <= 7
              ? 'THIS_WEEK'
              : daysToDue <= 14
                ? 'NEXT_WEEK'
                : 'LATER';
    rows.push({
      estimateId: e.id,
      jobId: e.jobId,
      projectName: e.projectName,
      ownerAgency: e.ownerAgency,
      bidDueDate: e.bidDueDate,
      bidTotalCents: totals.bidTotalCents,
      daysToDue,
      urgency,
    });
  }

  // Sort: OVERDUE first (most-overdue first), then TODAY, THIS_WEEK,
  // NEXT_WEEK, LATER. NO_DATE pinned to bottom. Ties broken by
  // bidTotal desc (bigger pursuits surface).
  const tierRank: Record<PursuitUrgency, number> = {
    OVERDUE: 0,
    TODAY: 1,
    THIS_WEEK: 2,
    NEXT_WEEK: 3,
    LATER: 4,
    NO_DATE: 5,
  };
  rows.sort((a, b) => {
    if (a.urgency !== b.urgency) return tierRank[a.urgency] - tierRank[b.urgency];
    if (a.urgency === 'OVERDUE') {
      return (a.daysToDue ?? 0) - (b.daysToDue ?? 0);
    }
    const ad = a.daysToDue ?? Number.POSITIVE_INFINITY;
    const bd = b.daysToDue ?? Number.POSITIVE_INFINITY;
    if (ad !== bd) return ad - bd;
    return b.bidTotalCents - a.bidTotalCents;
  });

  const byUrgency: Record<PursuitUrgency, number> = {
    OVERDUE: 0,
    TODAY: 0,
    THIS_WEEK: 0,
    NEXT_WEEK: 0,
    LATER: 0,
    NO_DATE: 0,
  };
  let totalBidValueCents = 0;
  let hotPipelineCents = 0;
  for (const r of rows) {
    byUrgency[r.urgency] += 1;
    totalBidValueCents += r.bidTotalCents;
    if (r.urgency === 'OVERDUE' || r.urgency === 'TODAY' || r.urgency === 'THIS_WEEK') {
      hotPipelineCents += r.bidTotalCents;
    }
  }

  return {
    rows,
    rollup: {
      total: rows.length,
      totalBidValueCents,
      byUrgency,
      hotPipelineCents,
    },
  };
}

/** Parse a free-form bidDueDate string and return integer days
 *  from asOf. Null when unparseable. UTC-anchored to avoid DST drift. */
function parseDueOffsetDays(raw: string | undefined, asOf: string): number | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  if (Number.isNaN(t)) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  if (Number.isNaN(a)) return null;
  // Round towards 0 so "in 4 hours" still reads as 0 days for the
  // TODAY bucket.
  return Math.round((t - a) / (24 * 60 * 60 * 1000));
}
