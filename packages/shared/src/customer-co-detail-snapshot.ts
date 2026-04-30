// Customer-anchored per-job change order detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: total CO count, proposed / approved /
// executed counts, total cost impact in cents, schedule impact in
// days, last CO date. Sorted by total cost impact desc.
//
// Pure derivation. No persisted records.

import type { ChangeOrder } from './change-order';
import type { Job } from './job';

export interface CustomerCoDetailRow {
  jobId: string;
  totalCos: number;
  proposed: number;
  approved: number;
  executed: number;
  rejected: number;
  totalCostImpactCents: number;
  totalScheduleDays: number;
  lastCoDate: string | null;
}

export interface CustomerCoDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerCoDetailRow[];
}

export interface CustomerCoDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerCoDetailSnapshot(
  inputs: CustomerCoDetailSnapshotInputs,
): CustomerCoDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

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
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        proposed: 0,
        approved: 0,
        executed: 0,
        rejected: 0,
        costCents: 0,
        scheduleDays: 0,
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const c of inputs.changeOrders) {
    if (!customerJobs.has(c.jobId)) continue;
    const onTimelineDate = c.proposedAt ?? (c.createdAt ? c.createdAt.slice(0, 10) : null);
    if (onTimelineDate && onTimelineDate > asOf) continue;

    const a = getAcc(c.jobId);
    a.total += 1;
    if (c.status === 'PROPOSED' || c.status === 'AGENCY_REVIEW') a.proposed += 1;
    else if (c.status === 'APPROVED') a.approved += 1;
    else if (c.status === 'EXECUTED') a.executed += 1;
    else if (c.status === 'REJECTED') a.rejected += 1;

    // Cost / schedule only count for COs that actually move the
    // contract — approved or executed.
    if (c.status === 'APPROVED' || c.status === 'EXECUTED') {
      a.costCents += c.totalCostImpactCents;
      a.scheduleDays += c.totalScheduleImpactDays;
    }
    if (onTimelineDate && (a.lastDate == null || onTimelineDate > a.lastDate)) {
      a.lastDate = onTimelineDate;
    }
  }

  const rows: CustomerCoDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      totalCos: a.total,
      proposed: a.proposed,
      approved: a.approved,
      executed: a.executed,
      rejected: a.rejected,
      totalCostImpactCents: a.costCents,
      totalScheduleDays: a.scheduleDays,
      lastCoDate: a.lastDate,
    }))
    .sort((a, b) => b.totalCostImpactCents - a.totalCostImpactCents || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
