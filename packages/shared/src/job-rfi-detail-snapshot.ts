// Job-anchored per-author RFI detail snapshot.
//
// Plain English: for one job, return one row per YGE employee who
// authored RFIs on it: total, status breakouts (open / answered /
// closed), avg days from sent to answered, last RFI date. Sorted
// by total desc.
//
// Pure derivation. No persisted records.

import type { Rfi } from './rfi';

export interface JobRfiDetailRow {
  authorEmployeeId: string;
  total: number;
  open: number;
  answered: number;
  closed: number;
  avgDaysToAnswer: number | null;
  lastRfiDate: string | null;
}

export interface JobRfiDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobRfiDetailRow[];
}

export interface JobRfiDetailSnapshotInputs {
  jobId: string;
  rfis: Rfi[];
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

export function buildJobRfiDetailSnapshot(
  inputs: JobRfiDetailSnapshotInputs,
): JobRfiDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    open: number;
    answered: number;
    closed: number;
    daysSum: number;
    daysCount: number;
    lastDate: string | null;
  };
  const byAuthor = new Map<string, Acc>();
  function getAcc(authorId: string): Acc {
    let a = byAuthor.get(authorId);
    if (!a) {
      a = { total: 0, open: 0, answered: 0, closed: 0, daysSum: 0, daysCount: 0, lastDate: null };
      byAuthor.set(authorId, a);
    }
    return a;
  }

  for (const r of inputs.rfis) {
    if (r.jobId !== inputs.jobId) continue;
    const onTimelineDate = r.sentAt ?? (r.createdAt ? r.createdAt.slice(0, 10) : null);
    if (onTimelineDate && onTimelineDate > asOf) continue;
    const author = r.askedByEmployeeId ?? '(unknown)';
    const a = getAcc(author);
    a.total += 1;
    if (r.status === 'CLOSED') a.closed += 1;
    else if (r.status === 'ANSWERED') a.answered += 1;
    else if (r.status === 'DRAFT' || r.status === 'SENT') a.open += 1;
    if (r.sentAt && r.answeredAt && r.answeredAt >= r.sentAt) {
      a.daysSum += daysBetween(r.sentAt, r.answeredAt);
      a.daysCount += 1;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: JobRfiDetailRow[] = [...byAuthor.entries()]
    .map(([authorEmployeeId, a]) => ({
      authorEmployeeId,
      total: a.total,
      open: a.open,
      answered: a.answered,
      closed: a.closed,
      avgDaysToAnswer: a.daysCount === 0 ? null : round2(a.daysSum / a.daysCount),
      lastRfiDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.authorEmployeeId.localeCompare(b.authorEmployeeId));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
