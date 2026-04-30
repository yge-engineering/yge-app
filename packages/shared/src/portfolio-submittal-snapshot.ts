// Portfolio submittal snapshot (point-in-time).
//
// Plain English: as-of today, count submittals by status mix
// (DRAFT / SUBMITTED / APPROVED / APPROVED_AS_NOTED /
// REVISE_RESUBMIT / REJECTED / WITHDRAWN), open-and-overdue,
// blocksOrdering, distinct jobs + authors.
//
// Pure derivation. No persisted records.

import type { Submittal, SubmittalStatus } from './submittal';

export interface PortfolioSubmittalSnapshotResult {
  totalSubmittals: number;
  byStatus: Partial<Record<SubmittalStatus, number>>;
  openCount: number;
  overdueCount: number;
  blocksOrderingCount: number;
  distinctJobs: number;
  distinctAuthors: number;
}

export interface PortfolioSubmittalSnapshotInputs {
  submittals: Submittal[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioSubmittalSnapshot(
  inputs: PortfolioSubmittalSnapshotInputs,
): PortfolioSubmittalSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<SubmittalStatus, number>();
  let openCount = 0;
  let overdueCount = 0;
  let blocksOrderingCount = 0;
  const jobs = new Set<string>();
  const authors = new Set<string>();

  for (const s of inputs.submittals) {
    const status: SubmittalStatus = s.status ?? 'DRAFT';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
    const isOpen =
      status === 'DRAFT' ||
      status === 'SUBMITTED' ||
      status === 'REVISE_RESUBMIT';
    if (isOpen) {
      openCount += 1;
      if (s.responseDueAt && s.responseDueAt < asOf && !s.returnedAt) {
        overdueCount += 1;
      }
    }
    if (s.blocksOrdering) blocksOrderingCount += 1;
    jobs.add(s.jobId);
    if (s.submittedByEmployeeId) authors.add(s.submittedByEmployeeId);
  }

  function toRecord(m: Map<SubmittalStatus, number>): Partial<Record<SubmittalStatus, number>> {
    const out: Partial<Record<SubmittalStatus, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    totalSubmittals: inputs.submittals.length,
    byStatus: toRecord(byStatus),
    openCount,
    overdueCount,
    blocksOrderingCount,
    distinctJobs: jobs.size,
    distinctAuthors: authors.size,
  };
}
