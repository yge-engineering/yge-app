// Equipment-anchored job footprint year-over-year.
//
// Plain English: for one equipment unit, collapse two years of
// dispatches into a comparison: distinct jobs + total
// dispatches per year, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentJobYoyResult {
  equipmentId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctJobs: number;
  priorDispatches: number;
  currentDistinctJobs: number;
  currentDispatches: number;
  jobsDelta: number;
  dispatchesDelta: number;
}

export interface EquipmentJobYoyInputs {
  equipmentId: string;
  equipmentName?: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEquipmentJobYoy(inputs: EquipmentJobYoyInputs): EquipmentJobYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.equipmentName);

  type Bucket = { jobs: Set<string>; dispatches: number };
  function emptyBucket(): Bucket {
    return { jobs: new Set(), dispatches: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    let appeared = false;
    for (const slot of d.equipment ?? []) {
      const idMatch = slot.equipmentId === inputs.equipmentId;
      const nameMatch = !slot.equipmentId && targetName && norm(slot.name) === targetName;
      if (idMatch || nameMatch) {
        appeared = true;
        break;
      }
    }
    if (!appeared) continue;
    b.dispatches += 1;
    b.jobs.add(d.jobId);
  }

  return {
    equipmentId: inputs.equipmentId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctJobs: prior.jobs.size,
    priorDispatches: prior.dispatches,
    currentDistinctJobs: current.jobs.size,
    currentDispatches: current.dispatches,
    jobsDelta: current.jobs.size - prior.jobs.size,
    dispatchesDelta: current.dispatches - prior.dispatches,
  };
}
