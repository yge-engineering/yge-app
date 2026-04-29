// Submittal volume by month.
//
// Plain English: bucket non-draft submittals by yyyy-mm of
// submittedAt (or createdAt slice if not yet sent) and count
// outcomes — APPROVED + APPROVED_AS_NOTED, REVISE_RESUBMIT,
// REJECTED, still pending. Tracks portfolio submittal load over
// time.
//
// Per row: month, total, submitted (still SUBMITTED status),
// approvedCount, reviseResubmitCount, rejectedCount,
// withdrawnCount, blockedOrderingCount, distinctJobs,
// avgTurnaroundDays.
//
// Sort by month asc.
//
// Different from submittal-turnaround (per-submittal),
// submittal-by-author (per-author), submittal-by-spec-section
// (per spec section), job-submittal-pipeline (per job).
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface SubmittalMonthlyVolumeRow {
  month: string;
  total: number;
  submitted: number;
  approvedCount: number;
  reviseResubmitCount: number;
  rejectedCount: number;
  withdrawnCount: number;
  blockedOrderingCount: number;
  distinctJobs: number;
  avgTurnaroundDays: number;
}

export interface SubmittalMonthlyVolumeRollup {
  monthsConsidered: number;
  totalSubmittals: number;
  monthOverMonthChange: number;
}

export interface SubmittalMonthlyVolumeInputs {
  submittals: Submittal[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildSubmittalMonthlyVolume(
  inputs: SubmittalMonthlyVolumeInputs,
): {
  rollup: SubmittalMonthlyVolumeRollup;
  rows: SubmittalMonthlyVolumeRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    submitted: number;
    approved: number;
    revise: number;
    rejected: number;
    withdrawn: number;
    blocked: number;
    jobs: Set<string>;
    turnaroundSum: number;
    turnaroundCount: number;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    submitted: 0,
    approved: 0,
    revise: 0,
    rejected: 0,
    withdrawn: 0,
    blocked: 0,
    jobs: new Set<string>(),
    turnaroundSum: 0,
    turnaroundCount: 0,
  });
  const buckets = new Map<string, Bucket>();

  for (const s of inputs.submittals) {
    if (s.status === 'DRAFT') continue;
    const ref = s.submittedAt ?? s.createdAt.slice(0, 10);
    const month = ref.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    if (s.status === 'SUBMITTED') b.submitted += 1;
    else if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') b.approved += 1;
    else if (s.status === 'REVISE_RESUBMIT') b.revise += 1;
    else if (s.status === 'REJECTED') b.rejected += 1;
    else if (s.status === 'WITHDRAWN') b.withdrawn += 1;
    if (s.blocksOrdering) b.blocked += 1;
    b.jobs.add(s.jobId);
    if (s.submittedAt && s.returnedAt) {
      b.turnaroundSum += daysBetween(s.submittedAt, s.returnedAt);
      b.turnaroundCount += 1;
    }
    buckets.set(month, b);
  }

  const rows: SubmittalMonthlyVolumeRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      total: b.total,
      submitted: b.submitted,
      approvedCount: b.approved,
      reviseResubmitCount: b.revise,
      rejectedCount: b.rejected,
      withdrawnCount: b.withdrawn,
      blockedOrderingCount: b.blocked,
      distinctJobs: b.jobs.size,
      avgTurnaroundDays: b.turnaroundCount === 0
        ? 0
        : Math.round((b.turnaroundSum / b.turnaroundCount) * 100) / 100,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.total - prev.total;
  }

  let totalSubmittals = 0;
  for (const r of rows) totalSubmittals += r.total;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalSubmittals,
      monthOverMonthChange: mom,
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
