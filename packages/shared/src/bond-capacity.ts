// Surety bond capacity tracker.
//
// Brook (President) owns the bonding relationship. The surety
// underwrites two limits: a SINGLE-JOB cap (the biggest bond they'll
// write for one project) and an AGGREGATE cap (the total bonded
// backlog across all active jobs). When backlog approaches the
// aggregate cap, no more bonds will be issued until earlier jobs
// close out — which means a big upcoming bid might be dead on
// arrival even if the single-job number fits.
//
// This module is the pure rollup. Given the surety's
// bondingAggregateCapCents + the list of bonded jobs (with their
// current contract value remaining), it returns:
//   - used $        — sum of remaining contract value across active bonded jobs
//   - available $   — aggregate cap - used
//   - utilization % — used / cap
//   - upcoming-bid headroom — same calc with one prospective job added
//
// All inputs in cents (per project convention). No DB.

import { z } from 'zod';

export const BondedJobSchema = z.object({
  jobId: z.string().min(1),
  projectName: z.string().min(1).max(300),
  /** Contract value remaining for the surety's exposure calculation.
   *  Usually = totalContractCents - billedToDateCents. */
  remainingContractCents: z.number().int().nonnegative(),
});
export type BondedJob = z.infer<typeof BondedJobSchema>;

export interface BondCapacityRollup {
  /** Aggregate cap from the surety. 0 = none configured. */
  aggregateCapCents: number;
  /** Sum of remainingContractCents across active bonded jobs. */
  usedCents: number;
  /** aggregateCap - used, clamped at 0. */
  availableCents: number;
  /** used / cap as a decimal (0..1+). NaN when cap is 0. */
  utilization: number;
  /** True when usedCents > aggregateCap. */
  exceeded: boolean;
}

export function rollupBondCapacity(
  aggregateCapCents: number,
  bondedJobs: BondedJob[],
): BondCapacityRollup {
  if (aggregateCapCents < 0) throw new Error('aggregateCapCents must be non-negative');
  const used = bondedJobs.reduce((s, j) => s + j.remainingContractCents, 0);
  const available = Math.max(0, aggregateCapCents - used);
  const utilization = aggregateCapCents > 0 ? used / aggregateCapCents : NaN;
  return {
    aggregateCapCents,
    usedCents: used,
    availableCents: available,
    utilization: round4(utilization),
    exceeded: aggregateCapCents > 0 && used > aggregateCapCents,
  };
}

/** "If we win this prospective bond, what would utilization look like?" */
export function projectBondCapacityWithBid(
  current: BondCapacityRollup,
  prospectiveContractCents: number,
): {
  newUsedCents: number;
  newAvailableCents: number;
  newUtilization: number;
  fits: boolean;
} {
  if (prospectiveContractCents < 0) {
    throw new Error('prospectiveContractCents must be non-negative');
  }
  const newUsed = current.usedCents + prospectiveContractCents;
  const newAvailable = Math.max(0, current.aggregateCapCents - newUsed);
  const newUtil =
    current.aggregateCapCents > 0 ? newUsed / current.aggregateCapCents : NaN;
  return {
    newUsedCents: newUsed,
    newAvailableCents: newAvailable,
    newUtilization: round4(newUtil),
    fits: current.aggregateCapCents > 0 && newUsed <= current.aggregateCapCents,
  };
}

/** Cost of a bond at the surety's rate. bondRateBps is in basis points
 *  (e.g. 125 = 1.25%). Returns cents. */
export function bondPremiumCents(
  contractCents: number,
  bondRateBps: number,
): number {
  if (contractCents < 0 || bondRateBps < 0) {
    throw new Error('contractCents + bondRateBps must be non-negative');
  }
  return Math.round((contractCents * bondRateBps) / 10000);
}

/** Returns true when the prospective bid blows past the SINGLE-JOB cap. */
export function exceedsSingleJobCap(
  singleJobCapCents: number,
  prospectiveContractCents: number,
): boolean {
  if (singleJobCapCents <= 0) return false; // no cap configured = no check
  return prospectiveContractCents > singleJobCapCents;
}

function round4(n: number): number {
  if (Number.isNaN(n)) return NaN;
  return Math.round(n * 10000) / 10000;
}
