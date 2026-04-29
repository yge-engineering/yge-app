// Per-job submittal portfolio summary.
//
// Plain English: roll the submittal log up by jobId — total
// volume, status mix, blocked-ordering count, distinct authors,
// distinct spec sections, avg turnaround days, last submittedAt.
//
// Per row: jobId, total, approvedCount, reviseResubmitCount,
// rejectedCount, withdrawnCount, pendingCount,
// blockedOrderingCount, distinctAuthors, distinctSpecSections,
// avgTurnaroundDays, lastSubmittedAt.
//
// Sort by total desc.
//
// Different from job-submittal-pipeline (active-work view),
// job-submittal-kind-mix (kind axis), submittal-by-author (per
// author), submittal-by-spec-section (per spec section).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalByJobRow {
  jobId: string;
  total: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  pendingCount: number;
  blockedOrderingCount: number;
  distinctAuthors: number;
  distinctSpecSections: number;
  avgTurnaroundDays: number;
  lastSubmittedAt: string | null;
}

export interface SubmittalByJobRollup {
  jobsConsidered: number;
  totalSubmittals: number;
}

export interface SubmittalByJobInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm-dd window applied to submittedAt. */
  fromDate?: string;
  toDate?: string;
}

export function buildSubmittalByJob(
  inputs: SubmittalByJobInputs,
): {
  rollup: SubmittalByJobRollup;
  rows: SubmittalByJobRow[];
} {
  type Acc = {
    jobId: string;
    total: number;
    approved: number;
    revise: number;
    rejected: number;
    withdrawn: number;
    pending: number;
    blocked: number;
    authors: Set<string>;
    sections: Set<string>;
    turnaroundSum: number;
    turnaroundCount: number;
    lastSubmittedAt: string | null;
  };
  const accs = new Map<string, Acc>();
  let totalSubmittals = 0;

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    if (inputs.fromDate && ref < inputs.fromDate) continue;
    if (inputs.toDate && ref > inputs.toDate) continue;
    totalSubmittals += 1;
    const acc = accs.get(s.jobId) ?? {
      jobId: s.jobId,
      total: 0,
      approved: 0,
      revise: 0,
      rejected: 0,
      withdrawn: 0,
      pending: 0,
      blocked: 0,
      authors: new Set<string>(),
      sections: new Set<string>(),
      turnaroundSum: 0,
      turnaroundCount: 0,
      lastSubmittedAt: null,
    };
    acc.total += 1;
    if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') acc.approved += 1;
    else if (s.status === 'REVISE_RESUBMIT') acc.revise += 1;
    else if (s.status === 'REJECTED') acc.rejected += 1;
    else if (s.status === 'WITHDRAWN') acc.withdrawn += 1;
    else if (s.status === 'SUBMITTED') acc.pending += 1;
    if (s.blocksOrdering) acc.blocked += 1;
    if (s.submittedByEmployeeId && s.submittedByEmployeeId.trim()) {
      acc.authors.add(s.submittedByEmployeeId.trim());
    }
    if (s.specSection && s.specSection.trim()) {
      acc.sections.add(s.specSection.trim().toLowerCase());
    }
    if (s.submittedAt && s.returnedAt) {
      acc.turnaroundSum += daysBetween(s.submittedAt, s.returnedAt);
      acc.turnaroundCount += 1;
    }
    if (s.submittedAt && (!acc.lastSubmittedAt || s.submittedAt > acc.lastSubmittedAt)) {
      acc.lastSubmittedAt = s.submittedAt;
    }
    accs.set(s.jobId, acc);
  }

  const rows: SubmittalByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      total: acc.total,
      approvedCount: acc.approved,
      reviseResubmitCount: acc.revise,
      rejectedCount: acc.rejected,
      withdrawnCount: acc.withdrawn,
      pendingCount: acc.pending,
      blockedOrderingCount: acc.blocked,
      distinctAuthors: acc.authors.size,
      distinctSpecSections: acc.sections.size,
      avgTurnaroundDays: acc.turnaroundCount === 0
        ? 0
        : Math.round((acc.turnaroundSum / acc.turnaroundCount) * 100) / 100,
      lastSubmittedAt: acc.lastSubmittedAt,
    });
  }

  rows.sort((a, b) => b.total - a.total);

  return {
    rollup: {
      jobsConsidered: rows.length,
      totalSubmittals,
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
