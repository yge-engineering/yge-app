// Customer-anchored per-job dispatch detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: total dispatches, posted, completed,
// distinct foremen, distinct crew, distinct equipment, last
// dispatch date. Sorted by total dispatches desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface CustomerDispatchDetailRow {
  jobId: string;
  total: number;
  posted: number;
  completed: number;
  distinctForemen: number;
  distinctCrew: number;
  distinctEquipment: number;
  lastDispatchDate: string | null;
}

export interface CustomerDispatchDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerDispatchDetailRow[];
}

export interface CustomerDispatchDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
  dispatches: Dispatch[];
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

export function buildCustomerDispatchDetailSnapshot(
  inputs: CustomerDispatchDetailSnapshotInputs,
): CustomerDispatchDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    posted: number;
    completed: number;
    foremen: Set<string>;
    crew: Set<string>;
    equipment: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = {
        total: 0,
        posted: 0,
        completed: 0,
        foremen: new Set(),
        crew: new Set(),
        equipment: new Set(),
        lastDate: null,
      };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;

    const a = getAcc(d.jobId);
    a.total += 1;
    if (d.status === 'POSTED') a.posted += 1;
    else if (d.status === 'COMPLETED') a.completed += 1;
    if (d.foremanName) a.foremen.add(norm(d.foremanName));
    for (const c of d.crew) {
      const key = c.employeeId ?? norm(c.name);
      if (key) a.crew.add(key);
    }
    for (const eq of d.equipment) {
      const key = eq.equipmentId ?? norm(eq.name);
      if (key) a.equipment.add(key);
    }
    if (a.lastDate == null || d.scheduledFor > a.lastDate) a.lastDate = d.scheduledFor;
  }

  const rows: CustomerDispatchDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      posted: a.posted,
      completed: a.completed,
      distinctForemen: a.foremen.size,
      distinctCrew: a.crew.size,
      distinctEquipment: a.equipment.size,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
