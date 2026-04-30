// Employee-anchored per-job mileage detail snapshot.
//
// Plain English: for one employee, return one row per job they
// drove for: trip count, total business miles, reimbursable
// cents (IRS rate × miles when on personal vehicle), last trip
// date. Sorted by trips desc.
//
// Pure derivation. No persisted records.

import type { MileageEntry } from './mileage';

export interface EmployeeMileageDetailRow {
  jobId: string;
  trips: number;
  miles: number;
  reimbursableCents: number;
  lastTripDate: string | null;
}

export interface EmployeeMileageDetailSnapshotResult {
  asOf: string;
  employeeId: string;
  rows: EmployeeMileageDetailRow[];
}

export interface EmployeeMileageDetailSnapshotInputs {
  employeeId: string;
  mileage: MileageEntry[];
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

export function buildEmployeeMileageDetailSnapshot(
  inputs: EmployeeMileageDetailSnapshotInputs,
): EmployeeMileageDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    trips: number;
    miles: number;
    reimb: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { trips: 0, miles: 0, reimb: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const m of inputs.mileage) {
    if (m.employeeId !== inputs.employeeId) continue;
    if (!m.jobId) continue;
    if (m.tripDate > asOf) continue;
    const a = getAcc(m.jobId);
    a.trips += 1;
    a.miles += m.businessMiles;
    if (m.isPersonalVehicle && m.irsRateCentsPerMile) {
      a.reimb += Math.round(m.businessMiles * m.irsRateCentsPerMile);
    }
    if (a.lastDate == null || m.tripDate > a.lastDate) a.lastDate = m.tripDate;
  }

  const rows: EmployeeMileageDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      trips: a.trips,
      miles: a.miles,
      reimbursableCents: a.reimb,
      lastTripDate: a.lastDate,
    }))
    .sort((a, b) => b.trips - a.trips || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    employeeId: inputs.employeeId,
    rows,
  };
}
