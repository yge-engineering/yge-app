// Job-anchored per-employee mileage detail snapshot.
//
// Plain English: for one job, return one row per employee who
// drove for it: trip count, total business miles, IRS reimbursable
// cents (personal vehicle × IRS rate), distinct purposes, last
// trip date. Sorted by trips desc.
//
// Pure derivation. No persisted records.

import type { MileageEntry } from './mileage';

export interface JobMileageDetailRow {
  employeeId: string;
  employeeName: string;
  trips: number;
  miles: number;
  reimbursableCents: number;
  distinctPurposes: number;
  lastTripDate: string | null;
}

export interface JobMileageDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobMileageDetailRow[];
}

export interface JobMileageDetailSnapshotInputs {
  jobId: string;
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

export function buildJobMileageDetailSnapshot(
  inputs: JobMileageDetailSnapshotInputs,
): JobMileageDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    name: string;
    trips: number;
    miles: number;
    reimb: number;
    purposes: Set<string>;
    lastDate: string | null;
  };
  const byEmployee = new Map<string, Acc>();
  function getAcc(empId: string, name: string): Acc {
    let a = byEmployee.get(empId);
    if (!a) {
      a = { name, trips: 0, miles: 0, reimb: 0, purposes: new Set(), lastDate: null };
      byEmployee.set(empId, a);
    }
    return a;
  }

  for (const m of inputs.mileage) {
    if (m.jobId !== inputs.jobId) continue;
    if (m.tripDate > asOf) continue;
    const a = getAcc(m.employeeId, m.employeeName);
    a.trips += 1;
    a.miles += m.businessMiles;
    if (m.isPersonalVehicle && m.irsRateCentsPerMile) {
      a.reimb += Math.round(m.businessMiles * m.irsRateCentsPerMile);
    }
    a.purposes.add(m.purpose);
    if (a.lastDate == null || m.tripDate > a.lastDate) a.lastDate = m.tripDate;
  }

  const rows: JobMileageDetailRow[] = [...byEmployee.entries()]
    .map(([employeeId, a]) => ({
      employeeId,
      employeeName: a.name,
      trips: a.trips,
      miles: a.miles,
      reimbursableCents: a.reimb,
      distinctPurposes: a.purposes.size,
      lastTripDate: a.lastDate,
    }))
    .sort((a, b) => b.trips - a.trips || a.employeeId.localeCompare(b.employeeId));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
