// Estimate vs awarded contract variance.
//
// Plain English: when YGE submits a $1.2M bid and the agency
// awards a $1.15M contract, that 4% gap is real money. Most of
// the time the gap is zero — bid = award. Sometimes the agency
// negotiates scope down before signing. Tracking these gaps
// across history shows whether YGE's bid totals are getting
// trimmed disproportionately on certain agencies or scope types.
//
// Per AWARDED job with both a bid total and an awarded value:
//   - bid total
//   - awarded contract value
//   - variance ($ + %)
//   - tier: AWARDED_AT_BID / TRIMMED_LIGHT / TRIMMED_MED /
//     TRIMMED_HEAVY / AWARDED_OVER (rare, agency added to scope)
//
// Pure derivation. No persisted records.

import type { Job } from './job';

export type BidVarianceFlag =
  | 'AWARDED_AT_BID'    // within 1% of bid
  | 'TRIMMED_LIGHT'     // 1-5% below bid
  | 'TRIMMED_MED'       // 5-15% below bid
  | 'TRIMMED_HEAVY'     // >15% below bid
  | 'AWARDED_OVER';     // contract > bid (rare, scope added)

export interface BidVarianceRow {
  jobId: string;
  projectName: string;
  bidTotalCents: number;
  contractCents: number;
  /** contract - bid. Negative = trimmed. */
  varianceCents: number;
  /** variance / bid. */
  variancePct: number;
  flag: BidVarianceFlag;
}

export interface BidVarianceRollup {
  jobsConsidered: number;
  totalBidCents: number;
  totalContractCents: number;
  totalVarianceCents: number;
  blendedVariancePct: number;
  awardedAtBid: number;
  trimmedLight: number;
  trimmedMed: number;
  trimmedHeavy: number;
  awardedOver: number;
}

export interface BidVarianceInputs {
  jobs: Pick<Job, 'id' | 'projectName' | 'status'>[];
  /** Map<jobId, total bid amount cents>. */
  bidTotalByJobId: Map<string, number>;
  /** Map<jobId, awarded contract value cents>. */
  contractByJobId: Map<string, number>;
  /** When false (default), only AWARDED jobs are scored. */
  includeAllStatuses?: boolean;
}

export function buildBidToAwardVariance(
  inputs: BidVarianceInputs,
): {
  rollup: BidVarianceRollup;
  rows: BidVarianceRow[];
} {
  const includeAll = inputs.includeAllStatuses === true;

  const rows: BidVarianceRow[] = [];
  const counts = {
    awardedAtBid: 0,
    trimmedLight: 0,
    trimmedMed: 0,
    trimmedHeavy: 0,
    awardedOver: 0,
  };
  let totalBid = 0;
  let totalContract = 0;
  let totalVariance = 0;

  for (const j of inputs.jobs) {
    if (!includeAll && j.status !== 'AWARDED') continue;
    const bid = inputs.bidTotalByJobId.get(j.id);
    const contract = inputs.contractByJobId.get(j.id);
    if (bid == null || contract == null) continue;
    if (bid <= 0) continue;

    const variance = contract - bid;
    const pct = variance / bid;

    let flag: BidVarianceFlag;
    if (pct > 0.01) flag = 'AWARDED_OVER';
    else if (pct >= -0.01) flag = 'AWARDED_AT_BID';
    else if (pct >= -0.05) flag = 'TRIMMED_LIGHT';
    else if (pct >= -0.15) flag = 'TRIMMED_MED';
    else flag = 'TRIMMED_HEAVY';

    rows.push({
      jobId: j.id,
      projectName: j.projectName,
      bidTotalCents: bid,
      contractCents: contract,
      varianceCents: variance,
      variancePct: round4(pct),
      flag,
    });

    if (flag === 'AWARDED_AT_BID') counts.awardedAtBid += 1;
    else if (flag === 'TRIMMED_LIGHT') counts.trimmedLight += 1;
    else if (flag === 'TRIMMED_MED') counts.trimmedMed += 1;
    else if (flag === 'TRIMMED_HEAVY') counts.trimmedHeavy += 1;
    else counts.awardedOver += 1;

    totalBid += bid;
    totalContract += contract;
    totalVariance += variance;
  }

  // TRIMMED_HEAVY first (worst), then TRIMMED_MED, etc.;
  // largest |variance| desc within tier.
  const tierRank: Record<BidVarianceFlag, number> = {
    TRIMMED_HEAVY: 0,
    TRIMMED_MED: 1,
    TRIMMED_LIGHT: 2,
    AWARDED_AT_BID: 3,
    AWARDED_OVER: 4,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    return Math.abs(b.varianceCents) - Math.abs(a.varianceCents);
  });

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalBidCents: totalBid,
      totalContractCents: totalContract,
      totalVarianceCents: totalVariance,
      blendedVariancePct:
        totalBid === 0 ? 0 : round4(totalVariance / totalBid),
      ...counts,
    },
    rows,
  };
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
