// Job-anchored mileage year-over-year.
//
// Plain English: for one job, collapse two years of mileage
// trips into a comparison: trips, miles, IRS reimbursable
// cents, purpose mix, distinct employees, plus deltas.
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface JobMileageYoyResult {
  jobId: string;
  priorYear: number;
  currentYear: number;
  priorTrips: number;
  priorMiles: number;
  priorReimbursableCents: number;
  priorByPurpose: Partial<Record<MileagePurpose, number>>;
  priorDistinctEmployees: number;
  currentTrips: number;
  currentMiles: number;
  currentReimbursableCents: number;
  currentByPurpose: Partial<Record<MileagePurpose, number>>;
  currentDistinctEmployees: number;
  tripsDelta: number;
  milesDelta: number;
}

export interface JobMileageYoyInputs {
  jobId: string;
  mileage: MileageEntry[];
  currentYear: number;
}

export function buildJobMileageYoy(inputs: JobMileageYoyInputs): JobMileageYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    trips: number;
    miles: number;
    reimb: number;
    byPurpose: Map<MileagePurpose, number>;
    employees: Set<string>;
  };
  function emptyBucket(): Bucket {
    return { trips: 0, miles: 0, reimb: 0, byPurpose: new Map(), employees: new Set() };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const m of inputs.mileage) {
    if (m.jobId !== inputs.jobId) continue;
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
    b.employees.add(m.employeeId);
  }

  function purposeRecord(m: Map<MileagePurpose, number>): Partial<Record<MileagePurpose, number>> {
    const out: Partial<Record<MileagePurpose, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    jobId: inputs.jobId,
    priorYear,
    currentYear: inputs.currentYear,
    priorTrips: prior.trips,
    priorMiles: prior.miles,
    priorReimbursableCents: prior.reimb,
    priorByPurpose: purposeRecord(prior.byPurpose),
    priorDistinctEmployees: prior.employees.size,
    currentTrips: current.trips,
    currentMiles: current.miles,
    currentReimbursableCents: current.reimb,
    currentByPurpose: purposeRecord(current.byPurpose),
    currentDistinctEmployees: current.employees.size,
    tripsDelta: current.trips - prior.trips,
    milesDelta: current.miles - prior.miles,
  };
}
