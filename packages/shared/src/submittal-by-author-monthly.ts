// Per (author, month) submittal volume rollup.
//
// Plain English: bucket submittals by (submittedByEmployeeId,
// yyyy-mm of submittedAt). Counts submittals, breaks down by
// outcome status (APPROVED + APPROVED_AS_NOTED, REVISE_RESUBMIT,
// REJECTED, pending). Tracks per-author productivity month over
// month — distinct from submittal-by-author (lifetime) and
// submittal-monthly-volume (portfolio per month).
//
// Per row: submittedByEmployeeId, month, totalSubmitted,
// approvedCount, reviseResubmitCount, rejectedCount,
// blockedOrderingCount, distinctJobs.
//
// Sort: submittedByEmployeeId asc, month asc.
//
// Different from submittal-by-author (lifetime),
// submittal-monthly-volume (portfolio per month, no author),
// submittal-board (active list).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalByAuthorMonthlyRow {
  submittedByEmployeeId: string;
  month: string;
  totalSubmitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
}

export interface SubmittalByAuthorMonthlyRollup {
  authorsConsidered: number;
  monthsConsidered: number;
  totalSubmittals: number;
  noAuthorSkipped: number;
  noSubmittedAtSkipped: number;
}

export interface SubmittalByAuthorMonthlyInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm bounds inclusive applied to submittedAt. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildSubmittalByAuthorMonthly(
  inputs: SubmittalByAuthorMonthlyInputs,
): {
  rollup: SubmittalByAuthorMonthlyRollup;
  rows: SubmittalByAuthorMonthlyRow[];
} {
  type Acc = {
    submittedByEmployeeId: string;
    month: string;
    totalSubmitted: number;
    approvedCount: number;
    reviseResubmitCount: number;
    rejectedCount: number;
    blockedOrderingCount: number;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const authors = new Set<string>();
  const months = new Set<string>();

  let totalSubmittals = 0;
  let noAuthorSkipped = 0;
  let noSubmittedAtSkipped = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const s of inputs.submittals) {
    if (!s.submittedAt) {
      noSubmittedAtSkipped += 1;
      continue;
    }
    if (!s.submittedByEmployeeId) {
      noAuthorSkipped += 1;
      continue;
    }
    const month = s.submittedAt.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const key = `${s.submittedByEmployeeId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        submittedByEmployeeId: s.submittedByEmployeeId,
        month,
        totalSubmitted: 0,
        approvedCount: 0,
        reviseResubmitCount: 0,
        rejectedCount: 0,
        blockedOrderingCount: 0,
        jobs: new Set(),
      };
      accs.set(key, a);
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

    authors.add(s.submittedByEmployeeId);
    months.add(month);
    totalSubmittals += 1;
  }

  const rows: SubmittalByAuthorMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      submittedByEmployeeId: a.submittedByEmployeeId,
      month: a.month,
      totalSubmitted: a.totalSubmitted,
      approvedCount: a.approvedCount,
      reviseResubmitCount: a.reviseResubmitCount,
      rejectedCount: a.rejectedCount,
      blockedOrderingCount: a.blockedOrderingCount,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.submittedByEmployeeId !== y.submittedByEmployeeId) {
        return x.submittedByEmployeeId.localeCompare(y.submittedByEmployeeId);
      }
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      authorsConsidered: authors.size,
      monthsConsidered: months.size,
      totalSubmittals,
      noAuthorSkipped,
      noSubmittedAtSkipped,
    },
    rows,
  };
}
