// Per-employee per-job mileage rollup.
//
// Plain English: bucket mileage entries by (employeeId, jobId)
// — total miles + reimbursement \$ + trips + first/last trip
// date. Useful for the per-job labor-cost rebill and the "did
// we capture all the windshield time" review.
//
// Per row: employeeId, jobId, totalMiles, reimbursementCents,
// tripCount, firstTripOn, lastTripOn.
//
// Sort: employeeId asc, jobId asc.
//
// Different from employee-mileage-monthly (per-employee per-
// month), employee-mileage-rollup (per-employee lifetime),
// mileage-by-purpose (purpose breakdown).
//
// Pure derivation. No persisted records.

import type { MileageEntry } from './mileage';

export interface EmployeeMileageByJobRow {
  employeeId: string;
  jobId: string;
  totalMiles: number;
  reimbursementCents: number;
  tripCount: number;
  firstTripOn: string;
  lastTripOn: string;
}

export interface EmployeeMileageByJobRollup {
  employeesConsidered: number;
  jobsConsidered: number;
  totalMiles: number;
  reimbursementCents: number;
  unattributed: number;
}

export interface EmployeeMileageByJobInputs {
  mileageEntries: MileageEntry[];
  /** Optional yyyy-mm-dd window applied to tripDate. */
  fromDate?: string;
  toDate?: string;
}

export function buildEmployeeMileageByJob(
  inputs: EmployeeMileageByJobInputs,
): {
  rollup: EmployeeMileageByJobRollup;
  rows: EmployeeMileageByJobRow[];
} {
  type Acc = {
    employeeId: string;
    jobId: string;
    miles: number;
    reimbursement: number;
    trips: number;
    firstTrip: string;
    lastTrip: string;
  };
  const accs = new Map<string, Acc>();
  const empSet = new Set<string>();
  const jobSet = new Set<string>();
  let totalMiles = 0;
  let totalReimbursement = 0;
  let unattributed = 0;

  for (const m of inputs.mileageEntries) {
    if (inputs.fromDate && m.tripDate < inputs.fromDate) continue;
    if (inputs.toDate && m.tripDate > inputs.toDate) continue;
    if (!m.jobId) {
      unattributed += 1;
      continue;
    }
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    const key = `${m.employeeId}|${m.jobId}`;
    const acc = accs.get(key) ?? {
      employeeId: m.employeeId,
      jobId: m.jobId,
      miles: 0,
      reimbursement: 0,
      trips: 0,
      firstTrip: m.tripDate,
      lastTrip: m.tripDate,
    };
    acc.miles += m.businessMiles;
    acc.reimbursement += reimb;
    acc.trips += 1;
    if (m.tripDate < acc.firstTrip) acc.firstTrip = m.tripDate;
    if (m.tripDate > acc.lastTrip) acc.lastTrip = m.tripDate;
    accs.set(key, acc);
    empSet.add(m.employeeId);
    jobSet.add(m.jobId);
    totalMiles += m.businessMiles;
    totalReimbursement += reimb;
  }

  const rows: EmployeeMileageByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      employeeId: acc.employeeId,
      jobId: acc.jobId,
      totalMiles: Math.round(acc.miles * 100) / 100,
      reimbursementCents: acc.reimbursement,
      tripCount: acc.trips,
      firstTripOn: acc.firstTrip,
      lastTripOn: acc.lastTrip,
    });
  }

  rows.sort((a, b) => {
    if (a.employeeId !== b.employeeId) return a.employeeId.localeCompare(b.employeeId);
    return a.jobId.localeCompare(b.jobId);
  });

  return {
    rollup: {
      employeesConsidered: empSet.size,
      jobsConsidered: jobSet.size,
      totalMiles: Math.round(totalMiles * 100) / 100,
      reimbursementCents: totalReimbursement,
      unattributed,
    },
    rows,
  };
}
