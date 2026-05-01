// Job-anchored per-foreman dispatch detail snapshot.
//
// Plain English: for one job, return one row per foreman who led
// dispatches on it: total dispatches, posted, completed, cancelled,
// distinct crew members, distinct equipment units, last dispatch
// date. Sorted by total desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobDispatchDetailRow {
  foremanName: string;
  total: number;
  posted: number;
  completed: number;
  cancelled: number;
  distinctCrew: number;
  distinctEquipment: number;
  lastDispatchDate: string | null;
}

export interface JobDispatchDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobDispatchDetailRow[];
}

export interface JobDispatchDetailSnapshotInputs {
  jobId: string;
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

export function buildJobDispatchDetailSnapshot(
  inputs: JobDispatchDetailSnapshotInputs,
): JobDispatchDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    posted: number;
    completed: number;
    cancelled: number;
    crew: Set<string>;
    equipment: Set<string>;
    lastDate: string | null;
  };
  const byForeman = new Map<string, Acc>();
  function getAcc(fname: string): Acc {
    let a = byForeman.get(fname);
    if (!a) {
      a = { total: 0, posted: 0, completed: 0, cancelled: 0, crew: new Set(), equipment: new Set(), lastDate: null };
      byForeman.set(fname, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    const a = getAcc(d.foremanName);
    a.total += 1;
    if (d.status === 'POSTED') a.posted += 1;
    else if (d.status === 'COMPLETED') a.completed += 1;
    else if (d.status === 'CANCELLED') a.cancelled += 1;
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

  const rows: JobDispatchDetailRow[] = [...byForeman.entries()]
    .map(([foremanName, a]) => ({
      foremanName,
      total: a.total,
      posted: a.posted,
      completed: a.completed,
      cancelled: a.cancelled,
      distinctCrew: a.crew.size,
      distinctEquipment: a.equipment.size,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.total - a.total || a.foremanName.localeCompare(b.foremanName));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
