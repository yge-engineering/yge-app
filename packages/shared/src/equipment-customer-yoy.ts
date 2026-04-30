// Equipment-anchored customer footprint year-over-year.
//
// Plain English: for one equipment unit, collapse two years of
// dispatches into a comparison: distinct customers (via job-
// owner), distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Job } from './job';

export interface EquipmentCustomerYoyResult {
  equipmentId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctCustomers: number;
  priorDistinctJobs: number;
  currentDistinctCustomers: number;
  currentDistinctJobs: number;
  customersDelta: number;
}

export interface EquipmentCustomerYoyInputs {
  equipmentId: string;
  equipmentName?: string;
  jobs: Job[];
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEquipmentCustomerYoy(inputs: EquipmentCustomerYoyInputs): EquipmentCustomerYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.equipmentName);

  const jobOwner = new Map<string, string>();
  for (const j of inputs.jobs) {
    if (j.ownerAgency) jobOwner.set(j.id, j.ownerAgency);
  }

  type Bucket = { customers: Set<string>; jobs: Set<string> };
  function emptyBucket(): Bucket {
    return { customers: new Set(), jobs: new Set() };
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
    b.jobs.add(d.jobId);
    const owner = jobOwner.get(d.jobId);
    if (owner) b.customers.add(owner);
  }

  return {
    equipmentId: inputs.equipmentId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctCustomers: prior.customers.size,
    priorDistinctJobs: prior.jobs.size,
    currentDistinctCustomers: current.customers.size,
    currentDistinctJobs: current.jobs.size,
    customersDelta: current.customers.size - prior.customers.size,
  };
}
