// Job-anchored submittal snapshot.
//
// Plain English: for one job, as-of today, count submittals by
// status, count open and overdue, count blocks-ordering items,
// surface oldest open age in days. Drives the right-now per-job
// submittal overview.
//
// Pure derivation. No persisted records.

import type { Submittal, SubmittalStatus } from './submittal';

export interface JobSubmittalSnapshotResult {
  asOf: string;
  jobId: string;
  totalSubmittals: number;
  byStatus: Partial<Record<SubmittalStatus, number>>;
  openCount: number;
  overdueCount: number;
  blocksOrderingCount: number;
  oldestOpenAgeDays: number | null;
}

export interface JobSubmittalSnapshotInputs {
  jobId: string;
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

function daysBetween(fromIso: string, toIso: string): number {
  const f = Date.parse(fromIso);
  const t = Date.parse(toIso);
  if (Number.isNaN(f) || Number.isNaN(t)) return 0;
  return Math.floor((t - f) / (1000 * 60 * 60 * 24));
}

export function buildJobSubmittalSnapshot(
  inputs: JobSubmittalSnapshotInputs,
): JobSubmittalSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<SubmittalStatus, number>();
  let totalSubmittals = 0;
  let openCount = 0;
  let overdueCount = 0;
  let blocksOrderingCount = 0;
  let oldestOpenAgeDays: number | null = null;

  for (const s of inputs.submittals) {
    if (s.jobId !== inputs.jobId) continue;
    totalSubmittals += 1;
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
      const opened = s.submittedAt ?? s.createdAt;
      if (opened) {
        const age = daysBetween(opened.slice(0, 10), asOf);
        if (oldestOpenAgeDays == null || age > oldestOpenAgeDays) oldestOpenAgeDays = age;
      }
    }
    if (s.blocksOrdering) blocksOrderingCount += 1;
  }

  const out: Partial<Record<SubmittalStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalSubmittals,
    byStatus: out,
    openCount,
    overdueCount,
    blocksOrderingCount,
    oldestOpenAgeDays,
  };
}
