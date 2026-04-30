// Job-anchored equipment year-over-year.
//
// Plain English: for one job, collapse two years of equipment
// dispatch slots into a comparison: distinct units that
// touched the job, total slots, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface JobEquipmentYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctUnits: number;
  priorTotalSlots: number;
  currentDistinctUnits: number;
  currentTotalSlots: number;
  unitsDelta: number;
}

export interface JobEquipmentYoyInputs {
  jobId: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildJobEquipmentYoy(inputs: JobEquipmentYoyInputs): JobEquipmentYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = { units: Set<string>; slots: number };
  function emptyBucket(): Bucket {
    return { units: new Set(), slots: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    if (d.jobId !== inputs.jobId) continue;
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    for (const slot of d.equipment ?? []) {
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      if (key) b.units.add(key);
      b.slots += 1;
    }
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctUnits: prior.units.size,
    priorTotalSlots: prior.slots,
    currentDistinctUnits: current.units.size,
    currentTotalSlots: current.slots,
    unitsDelta: current.units.size - prior.units.size,
  };
}
