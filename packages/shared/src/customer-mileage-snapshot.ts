// Customer-anchored mileage snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count trips on their jobs, sum miles +
// reimbursable cents, purpose mix, distinct employees, last
// trip date.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { MileageEntry, MileagePurpose } from './mileage';

export interface CustomerMileageSnapshotResult {
  asOf: string;
  customerName: string;
  totalTrips: number;
  ytdTrips: number;
  totalMiles: number;
  ytdMiles: number;
  reimbursableCents: number;
  ytdReimbursableCents: number;
  byPurpose: Partial<Record<MileagePurpose, number>>;
  distinctEmployees: number;
  distinctJobs: number;
  lastTripDate: string | null;
}

export interface CustomerMileageSnapshotInputs {
  customerName: string;
  mileage: MileageEntry[];
  jobs: Job[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year. Defaults to year of asOf. */
  logYear?: number;
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

export function buildCustomerMileageSnapshot(
  inputs: CustomerMileageSnapshotInputs,
): CustomerMileageSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));
  const target = norm(inputs.customerName);

  const jobIds = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) jobIds.add(j.id);
  }

  const byPurpose = new Map<MileagePurpose, number>();
  const employees = new Set<string>();
  const jobs = new Set<string>();
  let totalTrips = 0;
  let ytdTrips = 0;
  let totalMiles = 0;
  let ytdMiles = 0;
  let reimbursableCents = 0;
  let ytdReimbursableCents = 0;
  let lastTripDate: string | null = null;

  for (const m of inputs.mileage) {
    if (!m.jobId || !jobIds.has(m.jobId)) continue;
    if (m.tripDate > asOf) continue;
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    totalTrips += 1;
    totalMiles += m.businessMiles;
    reimbursableCents += reimb;
    const purpose: MileagePurpose = m.purpose ?? 'JOBSITE_TRAVEL';
    byPurpose.set(purpose, (byPurpose.get(purpose) ?? 0) + 1);
    employees.add(m.employeeId);
    jobs.add(m.jobId);
    if (Number(m.tripDate.slice(0, 4)) === logYear) {
      ytdTrips += 1;
      ytdMiles += m.businessMiles;
      ytdReimbursableCents += reimb;
    }
    if (lastTripDate == null || m.tripDate > lastTripDate) lastTripDate = m.tripDate;
  }

  const out: Partial<Record<MileagePurpose, number>> = {};
  for (const [k, v] of byPurpose) out[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalTrips,
    ytdTrips,
    totalMiles,
    ytdMiles,
    reimbursableCents,
    ytdReimbursableCents,
    byPurpose: out,
    distinctEmployees: employees.size,
    distinctJobs: jobs.size,
    lastTripDate,
  };
}
