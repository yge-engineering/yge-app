// Customer-anchored per-job mileage detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job: trips, miles, IRS reimbursable cents,
// distinct employees, last trip date. Sorted by trips desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { MileageEntry } from './mileage';

export interface CustomerMileageDetailRow {
  jobId: string;
  trips: number;
  miles: number;
  reimbursableCents: number;
  distinctEmployees: number;
  lastTripDate: string | null;
}

export interface CustomerMileageDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerMileageDetailRow[];
}

export interface CustomerMileageDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerMileageDetailSnapshot(
  inputs: CustomerMileageDetailSnapshotInputs,
): CustomerMileageDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    trips: number;
    miles: number;
    reimb: number;
    employees: Set<string>;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { trips: 0, miles: 0, reimb: 0, employees: new Set(), lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const m of inputs.mileage) {
    if (!m.jobId || !customerJobs.has(m.jobId)) continue;
    if (m.tripDate > asOf) continue;
    const a = getAcc(m.jobId);
    a.trips += 1;
    a.miles += m.businessMiles;
    if (m.isPersonalVehicle && m.irsRateCentsPerMile) {
      a.reimb += Math.round(m.businessMiles * m.irsRateCentsPerMile);
    }
    a.employees.add(m.employeeId);
    if (a.lastDate == null || m.tripDate > a.lastDate) a.lastDate = m.tripDate;
  }

  const rows: CustomerMileageDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      trips: a.trips,
      miles: a.miles,
      reimbursableCents: a.reimb,
      distinctEmployees: a.employees.size,
      lastTripDate: a.lastDate,
    }))
    .sort((a, b) => b.trips - a.trips || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
