// Portfolio submittal year-over-year.
//
// Plain English: collapse two years of submittals into a
// single comparison row with status mix + blocksOrdering +
// distinct jobs/authors + deltas.
//
// Different from portfolio-submittal-monthly (per month).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface PortfolioSubmittalYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotalSubmitted: number;
  priorApprovedCount: number;
  priorReviseResubmitCount: number;
  priorRejectedCount: number;
  priorBlockedOrderingCount: number;
  priorDistinctJobs: number;
  priorDistinctAuthors: number;
  currentTotalSubmitted: number;
  currentApprovedCount: number;
  currentReviseResubmitCount: number;
  currentRejectedCount: number;
  currentBlockedOrderingCount: number;
  currentDistinctJobs: number;
  currentDistinctAuthors: number;
  totalSubmittedDelta: number;
}

export interface PortfolioSubmittalYoyInputs {
  submittals: Submittal[];
  currentYear: number;
}

export function buildPortfolioSubmittalYoy(
  inputs: PortfolioSubmittalYoyInputs,
): PortfolioSubmittalYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    totalSubmitted: number;
    approvedCount: number;
    reviseResubmitCount: number;
    rejectedCount: number;
    blockedOrderingCount: number;
    jobs: Set<string>;
    authors: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      totalSubmitted: 0,
      approvedCount: 0,
      reviseResubmitCount: 0,
      rejectedCount: 0,
      blockedOrderingCount: 0,
      jobs: new Set(),
      authors: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const s of inputs.submittals) {
    if (!s.submittedAt) continue;
    const year = Number(s.submittedAt.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.totalSubmitted += 1;
    const status = s.status ?? 'DRAFT';
    if (status === 'APPROVED' || status === 'APPROVED_AS_NOTED') {
      b.approvedCount += 1;
    } else if (status === 'REVISE_RESUBMIT') {
      b.reviseResubmitCount += 1;
    } else if (status === 'REJECTED') {
      b.rejectedCount += 1;
    }
    if (s.blocksOrdering) b.blockedOrderingCount += 1;
    b.jobs.add(s.jobId);
    if (s.submittedByEmployeeId) b.authors.add(s.submittedByEmployeeId);
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotalSubmitted: prior.totalSubmitted,
    priorApprovedCount: prior.approvedCount,
    priorReviseResubmitCount: prior.reviseResubmitCount,
    priorRejectedCount: prior.rejectedCount,
    priorBlockedOrderingCount: prior.blockedOrderingCount,
    priorDistinctJobs: prior.jobs.size,
    priorDistinctAuthors: prior.authors.size,
    currentTotalSubmitted: current.totalSubmitted,
    currentApprovedCount: current.approvedCount,
    currentReviseResubmitCount: current.reviseResubmitCount,
    currentRejectedCount: current.rejectedCount,
    currentBlockedOrderingCount: current.blockedOrderingCount,
    currentDistinctJobs: current.jobs.size,
    currentDistinctAuthors: current.authors.size,
    totalSubmittedDelta: current.totalSubmitted - prior.totalSubmitted,
  };
}
