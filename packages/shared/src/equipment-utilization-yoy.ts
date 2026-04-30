// Equipment-anchored utilization year-over-year.
//
// Plain English: for one equipment unit, collapse two years of
// dispatch appearances into a comparison: total dispatches,
// distinct jobs + foremen + operators, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentUtilizationYoyResult {
  equipmentId: string;
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorDistinctJobs: number;
  priorDistinctOperators: number;
  currentTotal: number;
  currentDistinctJobs: number;
  currentDistinctOperators: number;
  totalDelta: number;
}

export interface EquipmentUtilizationYoyInputs {
  equipmentId: string;
  equipmentName?: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEquipmentUtilizationYoy(
  inputs: EquipmentUtilizationYoyInputs,
): EquipmentUtilizationYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.equipmentName);

  type Bucket = { total: number; jobs: Set<string>; operators: Set<string> };
  function emptyBucket(): Bucket {
    return { total: 0, jobs: new Set(), operators: new Set() };
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
    let opName: string | undefined;
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
    b.total += 1;
    b.jobs.add(d.jobId);
    if (opName) b.operators.add(opName.trim().toLowerCase());
  }

  return {
    equipmentId: inputs.equipmentId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorDistinctJobs: prior.jobs.size,
    priorDistinctOperators: prior.operators.size,
    currentTotal: current.total,
    currentDistinctJobs: current.jobs.size,
    currentDistinctOperators: current.operators.size,
    totalDelta: current.total - prior.total,
  };
}
