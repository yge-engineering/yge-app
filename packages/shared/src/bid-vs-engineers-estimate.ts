// Bid vs engineer's estimate variance.
//
// Plain English: every public-works bid result we capture should
// have the agency's engineer's estimate (what they thought the
// project would cost) and YGE's bid total. Comparing the two
// across history shows whether we tend to come in low (winning
// margin work) or high (chasing the wrong projects). Some
// agencies publish optimistic estimates, others realistic — the
// per-customer view (bid-win-rate-by-customer) helps separate
// those.
//
// Per row: bidResultId, jobId, bidOpenedAt, ygeBidCents,
// engineersEstimateCents, varianceCents (yge - engineer),
// variancePct (yge / engineer - 1), tier:
//   BELOW       — yge < 95% of engineer's
//   AT          — yge 95-105% of engineer's
//   ABOVE       — yge > 105% of engineer's
//   MISSING     — no engineer's estimate or no YGE bidder line
//
// Sort: variancePct ascending (most-aggressive bids first),
// MISSING last.
//
// Different from bid-to-award-variance (bid vs awarded
// contract), bid-win-rate-by-customer (per-customer outcomes),
// and competitor-frequency. This is the bid-discipline view
// against the agency's published number.
//
// Pure derivation. No persisted records.

import type { BidResult } from './bid-result';

export type BidVsEngineersTier = 'BELOW' | 'AT' | 'ABOVE' | 'MISSING';

export interface BidVsEngineersRow {
  bidResultId: string;
  jobId: string;
  bidOpenedAt: string;
  ygeBidCents: number | null;
  engineersEstimateCents: number | null;
  varianceCents: number | null;
  variancePct: number | null;
  tier: BidVsEngineersTier;
}

export interface BidVsEngineersRollup {
  resultsConsidered: number;
  belowCount: number;
  atCount: number;
  aboveCount: number;
  missingCount: number;
  avgVariancePct: number;
}

export interface BidVsEngineersInputs {
  bidResults: BidResult[];
  /** Optional yyyy-mm-dd window applied to bidOpenedAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildBidVsEngineersEstimate(
  inputs: BidVsEngineersInputs,
): {
  rollup: BidVsEngineersRollup;
  rows: BidVsEngineersRow[];
} {
  const rows: BidVsEngineersRow[] = [];
  let below = 0;
  let at = 0;
  let above = 0;
  let missing = 0;
  let pctSum = 0;
  let pctCount = 0;

  for (const r of inputs.bidResults) {
    if (inputs.fromDate && r.bidOpenedAt < inputs.fromDate) continue;
    if (inputs.toDate && r.bidOpenedAt > inputs.toDate) continue;
    const yge = (r.bidders ?? []).find((b) => b.isYge);
    const ygeAmount = yge ? yge.amountCents : null;
    const engineer = r.engineersEstimateCents ?? null;
    let tier: BidVsEngineersTier;
    let variance: number | null = null;
    let pct: number | null = null;
    if (!ygeAmount || !engineer || engineer <= 0) {
      tier = 'MISSING';
      missing += 1;
    } else {
      variance = ygeAmount - engineer;
      pct = Math.round((ygeAmount / engineer - 1) * 10_000) / 10_000;
      if (ygeAmount < 0.95 * engineer) {
        tier = 'BELOW';
        below += 1;
      } else if (ygeAmount > 1.05 * engineer) {
        tier = 'ABOVE';
        above += 1;
      } else {
        tier = 'AT';
        at += 1;
      }
      pctSum += pct;
      pctCount += 1;
    }
    rows.push({
      bidResultId: r.id,
      jobId: r.jobId,
      bidOpenedAt: r.bidOpenedAt,
      ygeBidCents: ygeAmount,
      engineersEstimateCents: engineer,
      varianceCents: variance,
      variancePct: pct,
      tier,
    });
  }

  rows.sort((a, b) => {
    if (a.tier === 'MISSING' && b.tier === 'MISSING') return 0;
    if (a.tier === 'MISSING') return 1;
    if (b.tier === 'MISSING') return -1;
    if (a.variancePct == null && b.variancePct == null) return 0;
    if (a.variancePct == null) return 1;
    if (b.variancePct == null) return -1;
    return a.variancePct - b.variancePct;
  });

  const avgPct = pctCount === 0
    ? 0
    : Math.round((pctSum / pctCount) * 10_000) / 10_000;

  return {
    rollup: {
      resultsConsidered: rows.length,
      belowCount: below,
      atCount: at,
      aboveCount: above,
      missingCount: missing,
      avgVariancePct: avgPct,
    },
    rows,
  };
}
