// Per-author submittal productivity.
//
// Plain English: every submittal carries the YGE employee who
// authored + sent it (submittedByEmployeeId). Roll the log up by
// that author so we can see who's running clean approvals and
// who keeps getting REVISE_RESUBMIT rounds. Resubmittal cycles
// are pure schedule risk — every loop is 10-14 working days the
// agency holds a fab order.
//
// Per row: submittedByEmployeeId, totalSubmitted, approvedCount
// (APPROVED + APPROVED_AS_NOTED), reviseResubmitCount,
// rejectedCount, blockedOrderingCount, distinctJobs,
// avgTurnaroundDays (over rows with both submittedAt + returnedAt).
//
// Sort by totalSubmitted desc.
//
// Different from submittal-board (active list),
// submittal-turnaround (per-submittal timing), and
// job-submittal-pipeline (per-job). This is the author view.
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalByAuthorRow {
  submittedByEmployeeId: string;
  totalSubmitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
  avgTurnaroundDays: number;
}

export interface SubmittalByAuthorRollup {
  authorsConsidered: number;
  totalSubmitted: number;
  unattributed: number;
}

export interface SubmittalByAuthorInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm-dd window applied to submittedAt (or createdAt
   *  slice when submittedAt is not yet set). */
  fromDate?: string;
  toDate?: string;
}

export function buildSubmittalByAuthor(
  inputs: SubmittalByAuthorInputs,
): {
  rollup: SubmittalByAuthorRollup;
  rows: SubmittalByAuthorRow[];
} {
  type Acc = {
    author: string;
    total: number;
    approved: number;
    revise: number;
    rejected: number;
    blocked: number;
    jobs: Set<string>;
    turnaroundSum: number;
    turnaroundCount: number;
  };
  const accs = new Map<string, Acc>();
  let unattributed = 0;
  let total = 0;

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    if (inputs.fromDate && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref > inputs.toDate) continue;
    total += 1;
    const author = (s.submittedByEmployeeId ?? '').trim();
    if (!author) {
      unattributed += 1;
      continue;
    }
    const acc = accs.get(author) ?? {
      author,
      total: 0,
      approved: 0,
      revise: 0,
      rejected: 0,
      blocked: 0,
      jobs: new Set<string>(),
      turnaroundSum: 0,
      turnaroundCount: 0,
    };
    acc.total += 1;
    acc.jobs.add(s.jobId);
    if (s.blocksOrdering) acc.blocked += 1;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') acc.approved += 1;
    else if (s.status === 'REVISE_RESUBMIT') acc.revise += 1;
    else if (s.status === 'REJECTED') acc.rejected += 1;
    if (s.submittedAt && s.returnedAt) {
      const days = daysBetween(s.submittedAt, s.returnedAt);
      acc.turnaroundSum += days;
      acc.turnaroundCount += 1;
    }
    accs.set(author, acc);
  }

  const rows: SubmittalByAuthorRow[] = [];
  for (const acc of accs.values()) {
    const avg = acc.turnaroundCount === 0
      ? 0
      : Math.round((acc.turnaroundSum / acc.turnaroundCount) * 100) / 100;
    rows.push({
      submittedByEmployeeId: acc.author,
      totalSubmitted: acc.total,
      approvedCount: acc.approved,
      reviseResubmitCount: acc.revise,
      rejectedCount: acc.rejected,
      blockedOrderingCount: acc.blocked,
      distinctJobs: acc.jobs.size,
      avgTurnaroundDays: avg,
    });
  }

  rows.sort((a, b) => b.totalSubmitted - a.totalSubmitted);

  return {
    rollup: {
      authorsConsidered: rows.length,
      totalSubmitted: total,
      unattributed,
    },
    rows,
  };
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const a = Date.parse(fromYmd + 'T00:00:00Z');
  const b = Date.parse(toYmd + 'T00:00:00Z');
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}
