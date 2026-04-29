// Per (job, month) mileage rollup.
//
// Plain English: bucket mileage entries by (jobId, yyyy-mm of
// tripDate). Sums business miles, reimbursable cents (personal
// vehicle × IRS rate), counts trips, distinct employees, and
// breaks the count down by trip purpose. Tells YGE how much
// windshield time + reimbursable cost is rolling onto each job
// per month.
//
// Per row: jobId, month, trips, totalMiles, reimbursableCents,
// distinctEmployees, byPurpose.
//
// Sort: jobId asc, month asc.
//
// Different from employee-mileage-by-job (per-employee per-job
// all-time), employee-mileage-monthly (per-employee per-month),
// employee-mileage-monthly-by-purpose (per-employee per-month
// per-purpose), mileage-by-purpose (portfolio mix).
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface JobMileageMonthlyRow {
  jobId: string;
  month: string;
  trips: number;
  totalMiles: number;
  reimbursableCents: number;
  distinctEmployees: number;
  byPurpose: Partial<Record<MileagePurpose, number>>;
}

export interface JobMileageMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalTrips: number;
  totalMiles: number;
  reimbursableCents: number;
  unattributed: number;
}

export interface JobMileageMonthlyInputs {
  mileage: MileageEntry[];
  /** Optional yyyy-mm bounds inclusive applied to tripDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildJobMileageMonthly(
  inputs: JobMileageMonthlyInputs,
): {
  rollup: JobMileageMonthlyRollup;
  rows: JobMileageMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    trips: number;
    miles: number;
    reimb: number;
    employees: Set<string>;
    byPurpose: Map<MileagePurpose, number>;
  };
  const accs = new Map<string, Acc>();
  const jobs = new Set<string>();
  const months = new Set<string>();

  let totalTrips = 0;
  let totalMiles = 0;
  let reimbursableCents = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const m of inputs.mileage) {
    const month = m.tripDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    if (!m.jobId) {
      unattributed += 1;
      continue;
    }
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;

    const key = `${m.jobId}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        jobId: m.jobId,
        month,
        trips: 0,
        miles: 0,
        reimb: 0,
        employees: new Set(),
        byPurpose: new Map(),
      };
      accs.set(key, a);
    }
    a.trips += 1;
    a.miles += m.businessMiles;
    a.reimb += reimb;
    a.employees.add(m.employeeId);
    const purpose: MileagePurpose = m.purpose ?? 'JOBSITE_TRAVEL';
    a.byPurpose.set(purpose, (a.byPurpose.get(purpose) ?? 0) + 1);

    jobs.add(m.jobId);
    months.add(month);
    totalTrips += 1;
    totalMiles += m.businessMiles;
    reimbursableCents += reimb;
  }

  const rows: JobMileageMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byPurpose: Partial<Record<MileagePurpose, number>> = {};
      for (const [k, v] of a.byPurpose) byPurpose[k] = v;
      return {
        jobId: a.jobId,
        month: a.month,
        trips: a.trips,
        totalMiles: a.miles,
        reimbursableCents: a.reimb,
        distinctEmployees: a.employees.size,
        byPurpose,
      };
    })
    .sort((x, y) => {
      if (x.jobId !== y.jobId) return x.jobId.localeCompare(y.jobId);
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      jobsConsidered: jobs.size,
      monthsConsidered: months.size,
      totalTrips,
      totalMiles,
      reimbursableCents,
      unattributed,
    },
    rows,
  };
}
