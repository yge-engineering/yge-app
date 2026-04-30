// Equipment-anchored operator footprint year-over-year.
//
// Plain English: for one equipment unit, collapse two years of
// dispatches into a comparison: distinct operators per year +
// total dispatches, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentOperatorYoyResult {
  equipmentId: string;
  priorYear: number;
  currentYear: number;
  priorDistinctOperators: number;
  priorDispatches: number;
  currentDistinctOperators: number;
  currentDispatches: number;
  operatorsDelta: number;
}

export interface EquipmentOperatorYoyInputs {
  equipmentId: string;
  equipmentName?: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEquipmentOperatorYoy(inputs: EquipmentOperatorYoyInputs): EquipmentOperatorYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.equipmentName);

  type Bucket = { operators: Set<string>; dispatches: number };
  function emptyBucket(): Bucket {
    return { operators: new Set(), dispatches: 0 };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const d of inputs.dispatches) {
    const year = Number(d.scheduledFor.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    let opName: string | undefined;
    let appeared = false;
    for (const slot of d.equipment ?? []) {
      const idMatch = slot.equipmentId === inputs.equipmentId;
      const nameMatch = !slot.equipmentId && targetName && norm(slot.name) === targetName;
      if (idMatch || nameMatch) {
        appeared = true;
        opName = slot.operatorName ?? opName;
        break;
      }
    }
    if (!appeared) continue;
    b.dispatches += 1;
    if (opName) b.operators.add(norm(opName));
  }

  return {
    equipmentId: inputs.equipmentId,
    priorYear,
    currentYear: inputs.currentYear,
    priorDistinctOperators: prior.operators.size,
    priorDispatches: prior.dispatches,
    currentDistinctOperators: current.operators.size,
    currentDispatches: current.dispatches,
    operatorsDelta: current.operators.size - prior.operators.size,
  };
}
