// Job-anchored dispatch snapshot.
//
// Plain English: for one job, as-of today, count dispatches,
// sum crew + equipment slots, break down by status, count
// distinct foremen, surface last dispatch date. Drives the
// right-now per-job field-deployment overview.
//
// Pure derivation. No persisted records.

import type { Dispatch, DispatchStatus } from './dispatch';

export interface JobDispatchSnapshotResult {
  asOf: string;
  jobId: string;
  totalDispatches: number;
  totalCrewSeats: number;
  totalEquipmentSlots: number;
  byStatus: Partial<Record<DispatchStatus, number>>;
  distinctForemen: number;
  lastDispatchDate: string | null;
}

export interface JobDispatchSnapshotInputs {
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

export function buildJobDispatchSnapshot(
  inputs: JobDispatchSnapshotInputs,
): JobDispatchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byStatus = new Map<DispatchStatus, number>();
  const foremen = new Set<string>();
  let totalDispatches = 0;
  let totalCrewSeats = 0;
  let totalEquipmentSlots = 0;
  let lastDispatchDate: string | null = null;

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    if (d.scheduledFor > asOf) continue;
    totalDispatches += 1;
    totalCrewSeats += d.crew?.length ?? 0;
    totalEquipmentSlots += d.equipment?.length ?? 0;
    byStatus.set(d.status, (byStatus.get(d.status) ?? 0) + 1);
    if (d.foremanName) foremen.add(d.foremanName.trim().toLowerCase());
    if (lastDispatchDate == null || d.scheduledFor > lastDispatchDate) lastDispatchDate = d.scheduledFor;
  }

  const out: Partial<Record<DispatchStatus, number>> = {};
  for (const [k, v] of byStatus) out[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalDispatches,
    totalCrewSeats,
    totalEquipmentSlots,
    byStatus: out,
    distinctForemen: foremen.size,
    lastDispatchDate,
  };
}
