// Job-anchored per-reason CO detail snapshot.
//
// Plain English: for one job, return one row per CO reason
// (owner-directed, differing-site, design-revision, RFI-response,
// code-revision, weather-or-delay, scope-clarification, other):
// total, by status, total cost impact (approved + executed only),
// schedule-day impact, last CO date. Sorted by cost impact desc.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';

export interface JobCoDetailRow {
  reason: string;
  totalCos: number;
  proposed: number;
  approved: number;
  executed: number;
  rejected: number;
  totalCostImpactCents: number;
  totalScheduleDays: number;
  lastCoDate: string | null;
}

export interface JobCoDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobCoDetailRow[];
}

export interface JobCoDetailSnapshotInputs {
  jobId: string;
  changeOrders: ChangeOrder[];
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

export function buildJobCoDetailSnapshot(
  inputs: JobCoDetailSnapshotInputs,
): JobCoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    proposed: number;
    approved: number;
    executed: number;
    rejected: number;
    costCents: number;
    scheduleDays: number;
    lastDate: string | null;
  };
  const byReason = new Map<string, Acc>();
  function getAcc(reason: string): Acc {
    let a = byReason.get(reason);
    if (!a) {
      a = { total: 0, proposed: 0, approved: 0, executed: 0, rejected: 0, costCents: 0, scheduleDays: 0, lastDate: null };
      byReason.set(reason, a);
    }
    return a;
  }

  for (const c of inputs.changeOrders) {
    if (c.jobId !== inputs.jobId) continue;
    const onTimelineDate = c.proposedAt ?? (c.createdAt ? c.createdAt.slice(0, 10) : null);
    if (onTimelineDate && onTimelineDate > asOf) continue;
    const a = getAcc(c.reason);
    a.total += 1;
    if (c.status === 'PROPOSED' || c.status === 'AGENCY_REVIEW') a.proposed += 1;
    else if (c.status === 'APPROVED') a.approved += 1;
    else if (c.status === 'EXECUTED') a.executed += 1;
    else if (c.status === 'REJECTED') a.rejected += 1;
    if (c.status === 'APPROVED' || c.status === 'EXECUTED') {
      a.costCents += c.totalCostImpactCents;
      a.scheduleDays += c.totalScheduleImpactDays;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: JobCoDetailRow[] = [...byReason.entries()]
    .map(([reason, a]) => ({
      reason,
      totalCos: a.total,
      proposed: a.proposed,
      approved: a.approved,
      executed: a.executed,
      rejected: a.rejected,
      totalCostImpactCents: a.costCents,
      totalScheduleDays: a.scheduleDays,
      lastCoDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCostImpactCents - a.totalCostImpactCents || a.reason.localeCompare(b.reason));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
