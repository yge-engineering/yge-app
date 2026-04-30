// Employee-anchored mileage year-over-year.
//
// Plain English: for one employee, collapse two years of trips
// into a comparison: trips, miles, IRS reimbursable cents,
// purpose mix, distinct jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface EmployeeMileageYoyResult {
  employeeId: string;
  priorYear: number;
  currentYear: number;
  priorTrips: number;
  priorMiles: number;
  priorReimbursableCents: number;
  priorByPurpose: Partial<Record<MileagePurpose, number>>;
  priorDistinctJobs: number;
  currentTrips: number;
  currentMiles: number;
  currentReimbursableCents: number;
  currentByPurpose: Partial<Record<MileagePurpose, number>>;
  currentDistinctJobs: number;
  tripsDelta: number;
  milesDelta: number;
  reimbursableCentsDelta: number;
}

export interface EmployeeMileageYoyInputs {
  employeeId: string;
  mileage: MileageEntry[];
  currentYear: number;
}

export function buildEmployeeMileageYoy(
  inputs: EmployeeMileageYoyInputs,
): EmployeeMileageYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    trips: number;
    miles: number;
    reimb: number;
    byPurpose: Map<MileagePurpose, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { trips: 0, miles: 0, reimb: 0, byPurpose: new Map(), jobs: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const m of inputs.mileage) {
    if (m.employeeId !== inputs.employeeId) continue;
    const year = Number(m.tripDate.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    b.trips += 1;
    b.miles += m.businessMiles;
    b.reimb += reimb;
    const purpose: MileagePurpose = m.purpose ?? 'JOBSITE_TRAVEL';
    b.byPurpose.set(purpose, (b.byPurpose.get(purpose) ?? 0) + 1);
    if (m.jobId) b.jobs.add(m.jobId);
  }

  function purposeRecord(m: Map<MileagePurpose, number>): Partial<Record<MileagePurpose, number>> {
    const out: Partial<Record<MileagePurpose, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    employeeId: inputs.employeeId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTrips: prior.trips,
    priorMiles: prior.miles,
    priorReimbursableCents: prior.reimb,
    priorByPurpose: purposeRecord(prior.byPurpose),
    priorDistinctJobs: prior.jobs.size,
    currentTrips: current.trips,
    currentMiles: current.miles,
    currentReimbursableCents: current.reimb,
    currentByPurpose: purposeRecord(current.byPurpose),
    currentDistinctJobs: current.jobs.size,
    tripsDelta: current.trips - prior.trips,
    milesDelta: current.miles - prior.miles,
    reimbursableCentsDelta: current.reimb - prior.reimb,
  };
}
