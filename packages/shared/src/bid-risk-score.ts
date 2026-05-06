// Bid risk score.
//
// Plain English: roll the various "things that could bite us at bid
// open" signals into one number 0-100 (higher = more risk). The
// editor surfaces this above the bid grid so the estimator can see
// at 2:55pm whether the 3pm bid is ready or whether there are still
// loose ends to tie up.
//
// Each factor returns a contribution in points; the total is capped
// at 100. Weights live here so a single change tunes everything.

import type { PricedEstimate, PricedEstimateTotals } from './priced-estimate';
import { unacknowledgedAddenda } from './addendum';
import { classifySubBids } from './sub-bid';

export interface BidRiskFactor {
  /** Stable id for analytics + React keys. */
  id: string;
  /** Plain-English label shown to the estimator. */
  label: string;
  /** Points this factor adds to the total risk score. */
  contribution: number;
  /** Severity — blocker is "bid is dead on arrival", warn is "double-check". */
  severity: 'blocker' | 'warn' | 'info';
  /** Drill-down detail explaining what triggered this. */
  detail: string;
}

export interface BidRiskScore {
  /** 0-100. Higher = more risk. */
  score: number;
  /** Bucket the score into a single word for the banner. */
  level: 'green' | 'yellow' | 'red';
  /** Per-factor breakdown, contributions sorted desc. */
  factors: BidRiskFactor[];
}

/** Cap a value to 0..max. Helps every factor contribute its weight cap. */
function cap(value: number, max: number): number {
  return Math.max(0, Math.min(max, value));
}

export function computeBidRiskScore(
  est: PricedEstimate,
  totals: PricedEstimateTotals,
): BidRiskScore {
  const factors: BidRiskFactor[] = [];

  // 1. Unpriced lines — every blank price is a hole. 4 points each, cap 30.
  if (totals.unpricedLineCount > 0) {
    factors.push({
      id: 'unpriced-lines',
      label: `${totals.unpricedLineCount} line${totals.unpricedLineCount === 1 ? '' : 's'} unpriced`,
      contribution: cap(totals.unpricedLineCount * 4, 30),
      severity: 'blocker',
      detail:
        'A bid line with no unit price means the bid total is missing that scope. Fill or remove before bid open.',
    });
  }

  // 2. Un-acknowledged addenda — LARGE. 25 each, cap 50. Tossed at bid open.
  const unackAddenda = unacknowledgedAddenda(est.addenda).length;
  if (unackAddenda > 0) {
    factors.push({
      id: 'unacked-addenda',
      label: `${unackAddenda} addend${unackAddenda === 1 ? 'um' : 'a'} not acknowledged`,
      contribution: cap(unackAddenda * 25, 50),
      severity: 'blocker',
      detail:
        'Un-acknowledged addenda make the bid non-responsive. Open /estimates/<id>/addenda and check each one off.',
    });
  }

  // 3. LOW-confidence AI lines that haven't been reviewed. 1 point each cap 15.
  const lowUnreviewed = est.bidItems.filter(
    (it) => it.confidence === 'LOW' && it.reviewState !== 'accepted',
  ).length;
  if (lowUnreviewed > 0) {
    factors.push({
      id: 'low-conf-unreviewed',
      label: `${lowUnreviewed} LOW-confidence line${lowUnreviewed === 1 ? '' : 's'} unreviewed`,
      contribution: cap(lowUnreviewed * 1, 15),
      severity: 'warn',
      detail:
        'AI-drafted lines with LOW confidence need an estimator look before submission.',
    });
  }

  // 4. Flagged lines. 2 points each cap 10.
  const flagged = est.bidItems.filter((it) => it.reviewState === 'flagged').length;
  if (flagged > 0) {
    factors.push({
      id: 'flagged-lines',
      label: `${flagged} line${flagged === 1 ? '' : 's'} flagged`,
      contribution: cap(flagged * 2, 10),
      severity: 'warn',
      detail: 'These lines were marked for another look. Resolve before submission.',
    });
  }

  // 5. §4104 must-list subs missing. 8 each cap 30. Bid-killer if real.
  const subClass = classifySubBids(est.subBids, totals.bidTotalCents, est.projectType);
  const mustListMissing = subClass.mustList.filter(
    (s) => !s.contractorName.trim() || !s.cslbLicense?.trim(),
  ).length;
  if (mustListMissing > 0) {
    factors.push({
      id: 'subs-must-list-missing',
      label: `${mustListMissing} §4104 sub${mustListMissing === 1 ? '' : 's'} missing data`,
      contribution: cap(mustListMissing * 8, 30),
      severity: 'blocker',
      detail:
        'Subs above the §4104 threshold need a contractor name + CSLB license. Missing data is a tossed bid.',
    });
  }

  // 6. No bid security on a bid > $25k (when one is expected). 12 points.
  if (totals.bidTotalCents > 25_000_00 && !est.bidSecurity) {
    factors.push({
      id: 'no-bid-security',
      label: 'No bid security set',
      contribution: 12,
      severity: 'warn',
      detail:
        'Most CA public-works bids over $25k require a bid bond, certified check, or cashier check. Confirm and add.',
    });
  }

  const score = cap(
    factors.reduce((acc, f) => acc + f.contribution, 0),
    100,
  );
  const level: BidRiskScore['level'] =
    score >= 50 ? 'red' : score >= 20 ? 'yellow' : 'green';

  return {
    score,
    level,
    factors: factors.sort((a, b) => b.contribution - a.contribution),
  };
}
