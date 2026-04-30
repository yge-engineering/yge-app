// Employee-anchored dispatch year-over-year.
//
// Plain English: for one employee, collapse two years of
// dispatch appearances into a comparison: total appearances,
// as-foreman, as-crew, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeDispatchYoyResult {
  employeeId: string;
  employeeName: string;
  priorYear: number;
  currentYear: number;
  priorAppearances: number;
  priorAsForeman: number;
  priorAsCrew: number;
  priorDistinctJobs: number;
  currentAppearances: number;
  currentAsForeman: number;
  currentAsCrew: number;
  currentDistinctJobs: number;
  appearancesDelta: number;
}

export interface EmployeeDispatchYoyInputs {
  employeeId: string;
  employeeName: string;
  dispatches: Dispatch[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildEmployeeDispatchYoy(
  inputs: EmployeeDispatchYoyInputs,
): EmployeeDispatchYoyResult {
  const priorYear = inputs.currentYear - 1;
  const targetName = norm(inputs.employeeName);

  type Bucket = {
    appearances: number;
    asForeman: number;
    asCrew: number;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { appearances: 0, asForeman: 0, asCrew: 0, jobs: new Set() };
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
    if (norm(d.foremanName) === targetName) {
      b.asForeman += 1;
      appeared = true;
    }
    let onCrew = false;
    for (const c of d.crew ?? []) {
      const idMatch = c.employeeId === inputs.employeeId;
      const nameMatch = !c.employeeId && norm(c.name) === targetName;
      if (idMatch || nameMatch) {
        onCrew = true;
        appeared = true;
        break;
      }
    }
    if (onCrew) b.asCrew += 1;
    if (appeared) {
      b.appearances += 1;
      b.jobs.add(d.jobId);
    }
  }

  return {
    employeeId: inputs.employeeId,
    employeeName: inputs.employeeName,
    priorYear,
    currentYear: inputs.currentYear,
    priorAppearances: prior.appearances,
    priorAsForeman: prior.asForeman,
    priorAsCrew: prior.asCrew,
    priorDistinctJobs: prior.jobs.size,
    currentAppearances: current.appearances,
    currentAsForeman: current.asForeman,
    currentAsCrew: current.asCrew,
    currentDistinctJobs: current.jobs.size,
    appearancesDelta: current.appearances - prior.appearances,
  };
}
