// Job-anchored per-kind submittal detail snapshot.
//
// Plain English: for one job, return one row per submittal kind
// (shop drawing, product data, sample, certificate, etc.):
// total, open, returned (approved / approved-as-noted / revise /
// rejected), avg days from submitted to returned, last submittal
// date. Sorted by total desc.
//
// Pure derivation. No persisted records.

import type { Submittal } from './submittal';

export interface JobSubmittalDetailRow {
  kind: string;
  total: number;
  open: number;
  returned: number;
  approved: number;
  reviseResubmit: number;
  rejected: number;
  avgDaysToReturn: number | null;
  lastSubmittalDate: string | null;
}

export interface JobSubmittalDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobSubmittalDetailRow[];
}

export interface JobSubmittalDetailSnapshotInputs {
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

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(`${aIso}T00:00:00Z`);
  const b = Date.parse(`${bIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const RETURNED = new Set(['APPROVED', 'APPROVED_AS_NOTED', 'REVISE_RESUBMIT', 'REJECTED']);

export function buildJobSubmittalDetailSnapshot(
  inputs: JobSubmittalDetailSnapshotInputs,
): JobSubmittalDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    open: number;
    returned: number;
    approved: number;
    revise: number;
    rejected: number;
    daysSum: number;
    daysCount: number;
    lastDate: string | null;
  };
  const byKind = new Map<string, Acc>();
  function getAcc(kind: string): Acc {
    let a = byKind.get(kind);
    if (!a) {
      a = { total: 0, open: 0, returned: 0, approved: 0, revise: 0, rejected: 0, daysSum: 0, daysCount: 0, lastDate: null };
      byKind.set(kind, a);
    }
    return a;
  }

  for (const s of inputs.submittals) {
    if (s.jobId !== inputs.jobId) continue;
    const onTimelineDate = s.submittedAt ?? (s.createdAt ? s.createdAt.slice(0, 10) : null);
    if (onTimelineDate && onTimelineDate > asOf) continue;
    const a = getAcc(s.kind);
    a.total += 1;
    if (RETURNED.has(s.status)) {
      a.returned += 1;
      if (s.status === 'APPROVED' || s.status === 'APPROVED_AS_NOTED') a.approved += 1;
      else if (s.status === 'REVISE_RESUBMIT') a.revise += 1;
      else if (s.status === 'REJECTED') a.rejected += 1;
    } else if (s.status === 'DRAFT' || s.status === 'SUBMITTED') {
      a.open += 1;
    }
    if (s.submittedAt && s.returnedAt && s.returnedAt >= s.submittedAt) {
      a.daysSum += daysBetween(s.submittedAt, s.returnedAt);
      a.daysCount += 1;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: JobSubmittalDetailRow[] = [...byKind.entries()]
    .map(([kind, a]) => ({
      kind,
      total: a.total,
      open: a.open,
      returned: a.returned,
      approved: a.approved,
      reviseResubmit: a.revise,
      rejected: a.rejected,
      avgDaysToReturn: a.daysCount === 0 ? null : round2(a.daysSum / a.daysCount),
      lastSubmittalDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.kind.localeCompare(b.kind));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
