// Job-anchored mileage snapshot.
//
// Plain English: for one job, as-of today, count trips, sum
// miles + IRS-rate reimbursable cents, break down by purpose,
// count distinct employees, surface YTD totals + last trip
// date. Drives the right-now per-job windshield-time overview.
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface JobMileageSnapshotResult {
  asOf: string;
  jobId: string;
  totalTrips: number;
  ytdTrips: number;
  totalMiles: number;
  ytdMiles: number;
  reimbursableCents: number;
  ytdReimbursableCents: number;
  byPurpose: Partial<Record<MileagePurpose, number>>;
  distinctEmployees: number;
  lastTripDate: string | null;
}

export interface JobMileageSnapshotInputs {
  jobId: string;
  mileage: MileageEntry[];
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

export function buildJobMileageSnapshot(
  inputs: JobMileageSnapshotInputs,
): JobMileageSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byPurpose = new Map<MileagePurpose, number>();
  const employees = new Set<string>();
  let totalTrips = 0;
  let ytdTrips = 0;
  let totalMiles = 0;
  let ytdMiles = 0;
  let reimbursableCents = 0;
  let ytdReimbursableCents = 0;
  let lastTripDate: string | null = null;

  for (const m of inputs.mileage) {
    if (m.jobId !== inputs.jobId) continue;
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
    jobId: inputs.jobId,
    totalTrips,
    ytdTrips,
    totalMiles,
    ytdMiles,
    reimbursableCents,
    ytdReimbursableCents,
    byPurpose: out,
    distinctEmployees: employees.size,
    lastTripDate,
  };
}
