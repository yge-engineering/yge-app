// Stale change-order tracker.
//
// Plain English: a CO that's been sitting at the agency for a long
// time is money YGE has effectively earned but can't bill yet. The
// longer it sits, the more cash-flow drag it puts on the job. This
// walks PROPOSED + AGENCY_REVIEW + APPROVED change orders and
// surfaces which ones have been waiting too long.
//
// Tier ladder (days from proposedAt to asOf):
//   FRESH   <14 days   green
//   AGING   14-29       attention
//   STALE   30-59       chase the agency
//   STUCK   60+         escalate / claim
//
// Pure derivation. No persisted records.

import type { ChangeOrder, ChangeOrderStatus } from './change-order';

export type CoStaleness = 'FRESH' | 'AGING' | 'STALE' | 'STUCK';

export interface CoStaleRow {
  changeOrderId: string;
  jobId: string;
  changeOrderNumber: string;
  subject: string;
  status: ChangeOrderStatus;
  proposedAt: string | null;
  daysWaiting: number;
  totalCostImpactCents: number;
  staleness: CoStaleness;
}

export interface CoStaleRollup {
  open: number;
  fresh: number;
  aging: number;
  stale: number;
  stuck: number;
  /** Sum of |totalCostImpactCents| across STALE + STUCK — the dollar
   *  weight of work waiting on agency action. */
  exposureCents: number;
}

export interface CoStaleInputs {
  asOf?: string;
  changeOrders: ChangeOrder[];
}

export function buildCoStaleReport(inputs: CoStaleInputs): {
  rollup: CoStaleRollup;
  rows: CoStaleRow[];
} {
  const asOf = inputs.asOf ?? new Date().toISOString().slice(0, 10);
  const refNow = new Date(`${asOf}T00:00:00Z`);

  const rows: CoStaleRow[] = [];
  let exposureCents = 0;
  const counts = { fresh: 0, aging: 0, stale: 0, stuck: 0 };

  for (const co of inputs.changeOrders) {
    if (co.status !== 'PROPOSED' && co.status !== 'AGENCY_REVIEW' && co.status !== 'APPROVED') {
      continue;
    }
    const proposedDate = co.proposedAt ? parseDate(co.proposedAt) : null;
    const daysWaiting = proposedDate
      ? Math.max(0, daysBetween(proposedDate, refNow))
      : 0;
    const staleness = classify(daysWaiting);

    rows.push({
      changeOrderId: co.id,
      jobId: co.jobId,
      changeOrderNumber: co.changeOrderNumber,
      subject: co.subject,
      status: co.status,
      proposedAt: co.proposedAt ?? null,
      daysWaiting,
      totalCostImpactCents: co.totalCostImpactCents,
      staleness,
    });

    if (staleness === 'FRESH') counts.fresh += 1;
    else if (staleness === 'AGING') counts.aging += 1;
    else if (staleness === 'STALE') counts.stale += 1;
    else counts.stuck += 1;
    if (staleness === 'STALE' || staleness === 'STUCK') {
      exposureCents += Math.abs(co.totalCostImpactCents);
    }
  }

  // Stuck first, then by days-waiting desc.
  const tierRank: Record<CoStaleness, number> = {
    STUCK: 0,
    STALE: 1,
    AGING: 2,
    FRESH: 3,
  };
  rows.sort((a, b) => {
    if (a.staleness !== b.staleness) {
      return tierRank[a.staleness] - tierRank[b.staleness];
    }
    return b.daysWaiting - a.daysWaiting;
  });

  return {
    rollup: {
      open: rows.length,
      fresh: counts.fresh,
      aging: counts.aging,
      stale: counts.stale,
      stuck: counts.stuck,
      exposureCents,
    },
    rows,
  };
}

function classify(days: number): CoStaleness {
  if (days < 14) return 'FRESH';
  if (days < 30) return 'AGING';
  if (days < 60) return 'STALE';
  return 'STUCK';
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
