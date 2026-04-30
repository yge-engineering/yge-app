// Job-anchored equipment snapshot.
//
// Plain English: for one job, as-of today, count distinct
// equipment units that have either been ASSIGNED to the job
// (current state) OR appeared on a dispatch for the job. Roll
// up by category. Drives the right-now per-job equipment-on-job
// overview.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Equipment, EquipmentCategory } from './equipment';

export interface JobEquipmentSnapshotResult {
  asOf: string;
  jobId: string;
  totalUnitsEverOnJob: number;
  currentlyAssignedCount: number;
  byCategory: Partial<Record<EquipmentCategory, number>>;
  lastDispatchedDate: string | null;
}

export interface JobEquipmentSnapshotInputs {
  jobId: string;
  equipment: Equipment[];
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

export function buildJobEquipmentSnapshot(
  inputs: JobEquipmentSnapshotInputs,
): JobEquipmentSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const eqById = new Map<string, Equipment>();
  for (const eq of inputs.equipment) eqById.set(eq.id, eq);

  const everOnJob = new Set<string>();
  let lastDispatchedDate: string | null = null;

  for (const eq of inputs.equipment) {
    if (eq.assignedJobId === inputs.jobId && eq.status === 'ASSIGNED') {
      everOnJob.add(eq.id);
    }
  }
  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    for (const slot of d.equipment ?? []) {
      const id = slot.equipmentId;
      if (id) everOnJob.add(id);
      else if (slot.name) everOnJob.add(`name:${slot.name.trim().toLowerCase()}`);
    }
    if (lastDispatchedDate == null || d.scheduledFor > lastDispatchedDate) {
      lastDispatchedDate = d.scheduledFor;
    }
  }

  let currentlyAssignedCount = 0;
  for (const eq of inputs.equipment) {
    if (eq.assignedJobId === inputs.jobId && eq.status === 'ASSIGNED') {
      currentlyAssignedCount += 1;
    }
  }

  const byCategory = new Map<EquipmentCategory, number>();
  for (const id of everOnJob) {
    const eq = eqById.get(id);
    if (!eq) continue;
    byCategory.set(eq.category, (byCategory.get(eq.category) ?? 0) + 1);
  }
  const out: Partial<Record<EquipmentCategory, number>> = {};
  for (const [k, v] of byCategory) out[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalUnitsEverOnJob: everOnJob.size,
    currentlyAssignedCount,
    byCategory: out,
    lastDispatchedDate,
  };
}
