// Customer-anchored per-job punch list detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: punch item total, open count, closed
// count, safety / major / minor breakouts, overdue count
// (open + due before asOf), last identified date. Sorted by open
// items desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { PunchItem } from './punch-list';

export interface CustomerPunchDetailRow {
  jobId: string;
  total: number;
  open: number;
  closed: number;
  safety: number;
  major: number;
  minor: number;
  overdue: number;
  lastIdentifiedDate: string | null;
}

export interface CustomerPunchDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerPunchDetailRow[];
}

export interface CustomerPunchDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  punchItems: PunchItem[];
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

const OPEN_STATUSES = new Set(['OPEN', 'IN_PROGRESS', 'DISPUTED']);

export function buildCustomerPunchDetailSnapshot(
  inputs: CustomerPunchDetailSnapshotInputs,
): CustomerPunchDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    open: number;
    closed: number;
    safety: number;
    major: number;
    minor: number;
    overdue: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { total: 0, open: 0, closed: 0, safety: 0, major: 0, minor: 0, overdue: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const p of inputs.punchItems) {
    if (!customerJobs.has(p.jobId)) continue;
    if (p.identifiedOn > asOf) continue;
    const a = getAcc(p.jobId);
    a.total += 1;
    if (p.status === 'CLOSED' || p.status === 'WAIVED') a.closed += 1;
    if (OPEN_STATUSES.has(p.status)) a.open += 1;
    if (p.severity === 'SAFETY') a.safety += 1;
    else if (p.severity === 'MAJOR') a.major += 1;
    else if (p.severity === 'MINOR') a.minor += 1;
    if (OPEN_STATUSES.has(p.status) && p.dueOn && p.dueOn < asOf) a.overdue += 1;
    if (a.lastDate == null || p.identifiedOn > a.lastDate) a.lastDate = p.identifiedOn;
  }

  const rows: CustomerPunchDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      open: a.open,
      closed: a.closed,
      safety: a.safety,
      major: a.major,
      minor: a.minor,
      overdue: a.overdue,
      lastIdentifiedDate: a.lastDate,
    }))
    .sort((a, b) => b.open - a.open || b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
