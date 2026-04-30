// Employee-anchored equipment footprint year-over-year.
//
// Plain English: for one employee (matched on dispatch
// operatorName), collapse two years of dispatches into a
// comparison: distinct units operated + total dispatches per
// year, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeEquipmentYoyResult {
  employeeName: string;
  priorYear: number;
  currentYear: number;
  priorDistinctUnits: number;
  priorDispatches: number;
  currentDistinctUnits: number;
  currentDispatches: number;
  unitsDelta: number;
  dispatchesDelta: number;
}

export interface EmployeeEquipmentYoyInputs {
  employeeName: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeeEquipmentYoy(inputs: EmployeeEquipmentYoyInputs): EmployeeEquipmentYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.employeeName);

  type Bucket = { units: Set<string>; dispatches: number };
  function emptyBucket(): Bucket {
    return { units: new Set(), dispatches: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    for (const slot of d.equipment ?? []) {
      if (norm(slot.operatorName) !== target) continue;
      b.dispatches += 1;
      const key = slot.equipmentId ?? `name:${norm(slot.name)}`;
      if (key) b.units.add(key);
    }
  }

  return {
    employeeName: inputs.employeeName,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctUnits: prior.units.size,
    priorDispatches: prior.dispatches,
    currentDistinctUnits: current.units.size,
    currentDispatches: current.dispatches,
    unitsDelta: current.units.size - prior.units.size,
    dispatchesDelta: current.dispatches - prior.dispatches,
  };
}
