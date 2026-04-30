// Customer-anchored mileage year-over-year.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// collapse two years of mileage trips into a comparison: trip
// counts, total miles, IRS reimbursable cents, purpose mix,
// distinct employees + jobs, plus deltas.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { MileageEntry, MileagePurpose } from './mileage';

export interface CustomerMileageYoyResult {
  customerName: string;
  priorYear: number;
  currentYear: number;
  priorTrips: number;
  priorMiles: number;
  priorReimbursableCents: number;
  priorByPurpose: Partial<Record<MileagePurpose, number>>;
  priorDistinctEmployees: number;
  priorDistinctJobs: number;
  currentTrips: number;
  currentMiles: number;
  currentReimbursableCents: number;
  currentByPurpose: Partial<Record<MileagePurpose, number>>;
  currentDistinctEmployees: number;
  currentDistinctJobs: number;
  tripsDelta: number;
  milesDelta: number;
  reimbursableCentsDelta: number;
}

export interface CustomerMileageYoyInputs {
  customerName: string;
  mileage: MileageEntry[];
  jobs: Job[];
  currentYear: number;
}

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerMileageYoy(
  inputs: CustomerMileageYoyInputs,
): CustomerMileageYoyResult {
  const priorYear = inputs.currentYear - 1;
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Bucket = {
    trips: number;
    miles: number;
    reimb: number;
    byPurpose: Map<MileagePurpose, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      trips: 0,
      miles: 0,
      reimb: 0,
      byPurpose: new Map(),
      employees: new Set(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const m of inputs.mileage) {
    if (!m.jobId || !customerJobs.has(m.jobId)) continue;
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
    b.jobs.add(m.jobId);
  }

  function purposeRecord(m: Map<MileagePurpose, number>): Partial<Record<MileagePurpose, number>> {
    const out: Partial<Record<MileagePurpose, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    customerName: inputs.customerName,
    priorYear,
    currentYear: inputs.currentYear,
    priorTrips: prior.trips,
    priorMiles: prior.miles,
    priorReimbursableCents: prior.reimb,
    priorByPurpose: purposeRecord(prior.byPurpose),
    priorDistinctEmployees: prior.employees.size,
    priorDistinctJobs: prior.jobs.size,
    currentTrips: current.trips,
    currentMiles: current.miles,
    currentReimbursableCents: current.reimb,
    currentByPurpose: purposeRecord(current.byPurpose),
    currentDistinctEmployees: current.employees.size,
    currentDistinctJobs: current.jobs.size,
    tripsDelta: current.trips - prior.trips,
    milesDelta: current.miles - prior.miles,
    reimbursableCentsDelta: current.reimb - prior.reimb,
  };
}
