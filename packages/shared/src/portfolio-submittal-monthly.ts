// Portfolio submittal activity by month with status mix.
//
// Plain English: per yyyy-mm of submittedAt, count submittals
// with status mix (APPROVED + APPROVED_AS_NOTED, REVISE_RESUBMIT,
// REJECTED), blocksOrdering count, distinct jobs + authors.
// Drives the office's submittal-throughput trend chart.
//
// Per row: month, totalSubmitted, approvedCount, reviseResubmitCount,
// rejectedCount, blockedOrderingCount, distinctJobs, distinctAuthors.
//
// Sort: month asc.
//
// Different from submittal-monthly-volume (timing, no status),
// submittal-by-author-monthly (per author).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface PortfolioSubmittalMonthlyRow {
  month: string;
  totalSubmitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
  distinctAuthors: number;
}

export interface PortfolioSubmittalMonthlyRollup {
  monthsConsidered: number;
  totalSubmittals: number;
  noSubmittedAtSkipped: number;
}

export interface PortfolioSubmittalMonthlyInputs {
  submittals: Submittal[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioSubmittalMonthly(
  inputs: PortfolioSubmittalMonthlyInputs,
): {
  rollup: PortfolioSubmittalMonthlyRollup;
  rows: PortfolioSubmittalMonthlyRow[];
} {
  type Acc = {
    month: string;
    totalSubmitted: number;
    approvedCount: number;
    reviseResubmitCount: number;
    rejectedCount: number;
    blockedOrderingCount: number;
    jobs: Set<string>;
    authors: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalSubmittals = 0;
  let noSubmittedAtSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const s of inputs.submittals) {
    if (!s.submittedAt) {
      noSubmittedAtSkipped += 1;
      continue;
    }
    const month = s.submittedAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        totalSubmitted: 0,
        approvedCount: 0,
        reviseResubmitCount: 0,
        rejectedCount: 0,
        blockedOrderingCount: 0,
        jobs: new Set(),
        authors: new Set(),
      };
      accs.set(month, a);
    }
    a.totalSubmitted += 1;
    const status = s.status ?? 'DRAFT';
    if (status === 'APPROVED' || status === 'APPROVED_AS_NOTED') {
      a.approvedCount += 1;
    } else if (status === 'REVISE_RESUBMIT') {
      a.reviseResubmitCount += 1;
    } else if (status === 'REJECTED') {
      a.rejectedCount += 1;
    }
    if (s.blocksOrdering) a.blockedOrderingCount += 1;
    a.jobs.add(s.jobId);
    if (s.submittedByEmployeeId) a.authors.add(s.submittedByEmployeeId);
    totalSubmittals += 1;
  }

  const rows: PortfolioSubmittalMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      month: a.month,
      totalSubmitted: a.totalSubmitted,
      approvedCount: a.approvedCount,
      reviseResubmitCount: a.reviseResubmitCount,
      rejectedCount: a.rejectedCount,
      blockedOrderingCount: a.blockedOrderingCount,
      distinctJobs: a.jobs.size,
      distinctAuthors: a.authors.size,
    }))
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalSubmittals,
      noSubmittedAtSkipped,
    },
    rows,
  };
}
