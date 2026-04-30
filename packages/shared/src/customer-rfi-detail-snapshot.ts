// Customer-anchored per-job RFI detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: RFI total, open count, closed count,
// answered count, avg days from sent to answered, last RFI date.
// Sorted by total RFIs desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { Rfi } from './rfi';

export interface CustomerRfiDetailRow {
  jobId: string;
  total: number;
  open: number;
  answered: number;
  closed: number;
  avgDaysToAnswer: number | null;
  lastRfiDate: string | null;
}

export interface CustomerRfiDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerRfiDetailRow[];
}

export interface CustomerRfiDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
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

export function buildCustomerRfiDetailSnapshot(
  inputs: CustomerRfiDetailSnapshotInputs,
): CustomerRfiDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    open: number;
    answered: number;
    closed: number;
    answerDaysSum: number;
    answerDaysCount: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        open: 0,
        answered: 0,
        closed: 0,
        answerDaysSum: 0,
        answerDaysCount: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const r of inputs.rfis) {
    if (!customerJobs.has(r.jobId)) continue;
    // Pick the date that places this RFI on the timeline. Sent if
    // we have it, else createdAt's date prefix.
    const onTimelineDate = r.sentAt ?? (r.createdAt ? r.createdAt.slice(0, 10) : null);
    if (onTimelineDate && onTimelineDate > asOf) continue;

    const a = getAcc(r.jobId);
    a.total += 1;
    if (r.status === 'CLOSED') a.closed += 1;
    else if (r.status === 'ANSWERED') a.answered += 1;
    else if (r.status === 'DRAFT' || r.status === 'SENT') a.open += 1;

    if (r.sentAt && r.answeredAt && r.answeredAt >= r.sentAt) {
      a.answerDaysSum += daysBetween(r.sentAt, r.answeredAt);
      a.answerDaysCount += 1;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: CustomerRfiDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      open: a.open,
      answered: a.answered,
      closed: a.closed,
      avgDaysToAnswer: a.answerDaysCount === 0 ? null : round2(a.answerDaysSum / a.answerDaysCount),
      lastRfiDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
