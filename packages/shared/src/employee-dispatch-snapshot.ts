// Employee-anchored dispatch snapshot.
//
// Plain English: for one employee, as-of today, count
// dispatches where they were either listed as a crew member
// (matched by employeeId or by name) or named as foreman.
// Surfaces foreman-led count, crew-member count, distinct
// jobs, last appearance.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EmployeeDispatchSnapshotResult {
  asOf: string;
  employeeId: string;
  employeeName: string;
  totalAppearances: number;
  asForeman: number;
  asCrew: number;
  distinctJobs: number;
  lastAppearanceDate: string | null;
}

export interface EmployeeDispatchSnapshotInputs {
  employeeId: string;
  /** Printed name to fall back on when crew rows lack employeeId. */
  employeeName: string;
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

export function buildEmployeeDispatchSnapshot(
  inputs: EmployeeDispatchSnapshotInputs,
): EmployeeDispatchSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const targetName = norm(inputs.employeeName);

  const jobs = new Set<string>();
  let totalAppearances = 0;
  let asForeman = 0;
  let asCrew = 0;
  let lastAppearanceDate: string | null = null;

  for (const d of inputs.dispatches) {
    if (d.scheduledFor > asOf) continue;
    let appeared = false;
    if (norm(d.foremanName) === targetName) {
      asForeman += 1;
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
    if (onCrew) asCrew += 1;
    if (appeared) {
      totalAppearances += 1;
      jobs.add(d.jobId);
      if (lastAppearanceDate == null || d.scheduledFor > lastAppearanceDate) {
        lastAppearanceDate = d.scheduledFor;
      }
    }
  }

  return {
    asOf,
    employeeId: inputs.employeeId,
    employeeName: inputs.employeeName,
    totalAppearances,
    asForeman,
    asCrew,
    distinctJobs: jobs.size,
    lastAppearanceDate,
  };
}
