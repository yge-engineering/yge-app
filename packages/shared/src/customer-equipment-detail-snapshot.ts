// Customer-anchored per-job equipment detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job with distinct equipment units, total
// dispatch slots they filled, distinct operators driving them,
// last dispatch date. Sorted by distinct units desc.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface CustomerEquipmentDetailRow {
  jobId: string;
  distinctUnits: number;
  totalSlots: number;
  distinctOperators: number;
  lastDispatchDate: string | null;
}

export interface CustomerEquipmentDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerEquipmentDetailRow[];
}

export interface CustomerEquipmentDetailSnapshotInputs {
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

export function buildCustomerEquipmentDetailSnapshot(
  inputs: CustomerEquipmentDetailSnapshotInputs,
): CustomerEquipmentDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    units: Set<string>;
    slots: number;
    operators: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { units: new Set(), slots: 0, operators: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
    if (d.scheduledFor > asOf) continue;
    if (!d.equipment || d.equipment.length === 0) continue;
    const a = getAcc(d.jobId);
    for (const slot of d.equipment) {
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      a.units.add(key);
      a.slots += 1;
      if (slot.operatorName) a.operators.add(norm(slot.operatorName));
    }
    if (a.lastDate == null || d.scheduledFor > a.lastDate) a.lastDate = d.scheduledFor;
  }

  const rows: CustomerEquipmentDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      distinctUnits: a.units.size,
      totalSlots: a.slots,
      distinctOperators: a.operators.size,
      lastDispatchDate: a.lastDate,
    }))
    .sort((a, b) => b.distinctUnits - a.distinctUnits || b.totalSlots - a.totalSlots || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
