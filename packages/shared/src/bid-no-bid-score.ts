// Bid / no-bid coach — heuristic score 0..100.
//
// Quick numeric verdict for a prospective bid: should YGE pursue
// it? Each factor adds or subtracts from a base of 50. A score
// of 80+ means "definitely bid"; below 30 means "probably no-bid";
// 30-79 is the messy middle where Ryan has to think.
//
// Factors (each clamped so no single factor dominates):
//   +/- agency relationship (prior wins boost; prior fights deduct)
//   +/- margin expected vs floor
//   +/- bonded capacity headroom
//   +/- crew + equipment availability fit
//   +/- bid prep effort vs win probability
//   +/- strategic positioning (next-bid leverage, intro to new agency)
//
// Pure: no IO. Deterministic from inputs.

import { z } from 'zod';

export const BidNoBidInputSchema = z.object({
  /** Prior wins with this awarding body — more = stronger relationship. */
  priorWinsCount: z.number().int().nonnegative().default(0),
  /** Active disputes / complaints with this awarding body — counts down. */
  priorDisputesCount: z.number().int().nonnegative().default(0),
  /** Expected margin (decimal — 0.12 = 12%). */
  expectedMarginPct: z.number(),
  /** Minimum acceptable margin (decimal). */
  marginFloorPct: z.number().default(0.08),
  /** Bonding aggregate utilization AFTER winning (decimal — 0..1+). */
  bondAggregateUtilizationIfWon: z.number().nonnegative().default(0.5),
  /** Single-job bond cap exceeded? Hard 'no' factor. */
  exceedsSingleJobBondCap: z.boolean().default(false),
  /** Crew availability — 0 = no crew, 1 = plenty. */
  crewAvailability: z.number().min(0).max(1).default(0.75),
  /** Equipment availability same. */
  equipmentAvailability: z.number().min(0).max(1).default(0.75),
  /** Estimated bid prep hours (drives the effort deduction). */
  bidPrepHoursEstimate: z.number().nonnegative().default(20),
  /** Subjective win probability (decimal, 0..1). */
  estimatedWinProbability: z.number().min(0).max(1).default(0.4),
  /** True when winning opens a NEW awarding-agency relationship. */
  strategicNewAgency: z.boolean().default(false),
});
export type BidNoBidInput = z.infer<typeof BidNoBidInputSchema>;

export type BidNoBidVerdict = 'BID' | 'LEAN_BID' | 'TOSS_UP' | 'LEAN_NO_BID' | 'NO_BID';

export interface BidNoBidScore {
  score: number; // 0..100
  verdict: BidNoBidVerdict;
  /** Per-factor breakdown so the user understands the score. */
  factors: Array<{ label: string; delta: number; note?: string }>;
}

/** Deterministic scorer. */
export function scoreBidNoBid(input: BidNoBidInput): BidNoBidScore {
  const factors: Array<{ label: string; delta: number; note?: string }> = [];

  // Agency relationship (each prior win +3, each dispute -5, capped at ±15).
  let agency = input.priorWinsCount * 3 - input.priorDisputesCount * 5;
  agency = clamp(agency, -15, 15);
  factors.push({
    label: 'Agency relationship',
    delta: agency,
    note: `${input.priorWinsCount} wins, ${input.priorDisputesCount} disputes`,
  });

  // Margin vs floor: each point above floor +2; below floor -8.
  const marginDelta = input.expectedMarginPct - input.marginFloorPct;
  const marginScore = marginDelta >= 0
    ? clamp(Math.round(marginDelta * 100 * 2), 0, 20)
    : clamp(Math.round(marginDelta * 100 * 8), -30, 0);
  factors.push({
    label: 'Margin vs floor',
    delta: marginScore,
    note: `${(input.expectedMarginPct * 100).toFixed(1)}% vs ${(input.marginFloorPct * 100).toFixed(1)}% floor`,
  });

  // Bonding: hard rejection if exceeds single-job cap.
  if (input.exceedsSingleJobBondCap) {
    factors.push({ label: 'Single-job bond cap', delta: -50, note: 'Exceeded — talk to surety first' });
  }
  const bondUtilDelta =
    input.bondAggregateUtilizationIfWon >= 1
      ? -20
      : input.bondAggregateUtilizationIfWon >= 0.9
        ? -10
        : input.bondAggregateUtilizationIfWon >= 0.75
          ? -5
          : 0;
  factors.push({
    label: 'Bond aggregate after win',
    delta: bondUtilDelta,
    note: `${Math.round(input.bondAggregateUtilizationIfWon * 100)}%`,
  });

  // Resource fit (crew + equipment averaged).
  const resourceFit = (input.crewAvailability + input.equipmentAvailability) / 2;
  const resourceDelta = Math.round((resourceFit - 0.5) * 20);
  factors.push({
    label: 'Crew + equipment fit',
    delta: resourceDelta,
    note: `${Math.round(input.crewAvailability * 100)}% / ${Math.round(input.equipmentAvailability * 100)}%`,
  });

  // Effort vs win probability (1 point per 20 hours of prep, deducted by
  // win-probability factor).
  const effortDelta = Math.round(
    -input.bidPrepHoursEstimate / 20 + input.estimatedWinProbability * 10,
  );
  factors.push({
    label: 'Effort vs win probability',
    delta: clamp(effortDelta, -15, 10),
    note: `${input.bidPrepHoursEstimate}h prep, ${Math.round(input.estimatedWinProbability * 100)}% win`,
  });

  // Strategic.
  if (input.strategicNewAgency) {
    factors.push({ label: 'Strategic — new agency relationship', delta: 8 });
  }

  const score = clamp(
    50 + factors.reduce((s, f) => s + f.delta, 0),
    0,
    100,
  );
  const verdict: BidNoBidVerdict =
    score >= 80 ? 'BID'
      : score >= 65 ? 'LEAN_BID'
        : score >= 45 ? 'TOSS_UP'
          : score >= 25 ? 'LEAN_NO_BID'
            : 'NO_BID';

  return { score, verdict, factors };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}
