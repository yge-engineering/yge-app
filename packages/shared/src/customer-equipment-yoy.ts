// Customer-anchored equipment year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of equipment dispatch slots into a
// comparison: distinct units, total slots, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface CustomerEquipmentYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctUnits: number;
  priorTotalSlots: number;
  currentDistinctUnits: number;
  currentTotalSlots: number;
  unitsDelta: number;
}

export interface CustomerEquipmentYoyInputs {
  customerName: string;
  jobs: Job[];
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerEquipmentYoy(inputs: CustomerEquipmentYoyInputs): CustomerEquipmentYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = { units: Set<string>; slots: number };
  function emptyBucket(): Bucket {
    return { units: new Set(), slots: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    if (!customerJobs.has(d.jobId)) continue;
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
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctUnits: prior.units.size,
    priorTotalSlots: prior.slots,
    currentDistinctUnits: current.units.size,
    currentTotalSlots: current.slots,
    unitsDelta: current.units.size - prior.units.size,
  };
}
