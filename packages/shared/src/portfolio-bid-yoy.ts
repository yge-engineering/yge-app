// Portfolio bid pursuit year-over-year.
//
// Plain English: collapse two consecutive fiscal years of bid
// pursuits (Job records with bidDueDate) into a single YoY
// row. Counts pursuits, awarded, lost, no-bid, in-flight, and
// computes prior + current win rate over decided pursuits with
// a delta. Drives the executive bid-performance YoY line.
//
// Different from portfolio-bid-monthly (per month), bid-
// pursuit-monthly (per month), bid-result-by-month.
//
// Pure derivation. No persisted records.

import type { Job, JobStatus } from './job';

export interface PortfolioBidYoyResult {
  priorYear: number;
  currentYear: number;
  priorPursuits: number;
  priorAwarded: number;
  priorLost: number;
  priorNoBid: number;
  priorInFlight: number;
  priorWinRate: number | null;
  currentPursuits: number;
  currentAwarded: number;
  currentLost: number;
  currentNoBid: number;
  currentInFlight: number;
  currentWinRate: number | null;
  pursuitsDelta: number;
  awardedDelta: number;
  winRateDelta: number | null;
}

export interface PortfolioBidYoyInputs {
  jobs: Job[];
  /** The current (later) year. Prior year is currentYear - 1. */
  currentYear: number;
}

export function buildPortfolioBidYoy(
  inputs: PortfolioBidYoyInputs,
): PortfolioBidYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    pursuits: number;
    awarded: number;
    lost: number;
    noBid: number;
    inFlight: number;
  };
  const prior: Bucket = {
    pursuits: 0,
    awarded: 0,
    lost: 0,
    noBid: 0,
    inFlight: 0,
  };
  const current: Bucket = {
    pursuits: 0,
    awarded: 0,
    lost: 0,
    noBid: 0,
    inFlight: 0,
  };

  function bumpBucket(b: Bucket, status: JobStatus): void {
    b.pursuits += 1;
    if (status === 'AWARDED') b.awarded += 1;
    else if (status === 'LOST') b.lost += 1;
    else if (status === 'NO_BID') b.noBid += 1;
    else if (
      status === 'PROSPECT' ||
      status === 'PURSUING' ||
      status === 'BID_SUBMITTED'
    ) {
      b.inFlight += 1;
    }
  }

  for (const j of inputs.jobs) {
    const due = j.bidDueDate;
    if (!due || !/^\d{4}-\d{2}/.test(due)) continue;
    const year = Number(due.slice(0, 4));
    const status: JobStatus = j.status ?? 'PURSUING';
    if (year === priorYear) bumpBucket(prior, status);
    else if (year === inputs.currentYear) bumpBucket(current, status);
  }

  function winRate(b: Bucket): number | null {
    const denom = b.awarded + b.lost + b.noBid;
    return denom > 0 ? b.awarded / denom : null;
  }
  const priorWin = winRate(prior);
  const currentWin = winRate(current);
  const winDelta =
    priorWin !== null && currentWin !== null ? currentWin - priorWin : null;

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorPursuits: prior.pursuits,
    priorAwarded: prior.awarded,
    priorLost: prior.lost,
    priorNoBid: prior.noBid,
    priorInFlight: prior.inFlight,
    priorWinRate: priorWin,
    currentPursuits: current.pursuits,
    currentAwarded: current.awarded,
    currentLost: current.lost,
    currentNoBid: current.noBid,
    currentInFlight: current.inFlight,
    currentWinRate: currentWin,
    pursuitsDelta: current.pursuits - prior.pursuits,
    awardedDelta: current.awarded - prior.awarded,
    winRateDelta: winDelta,
  };
}
