// Per (purpose, month) mileage rollup.
//
// Plain English: bucket mileage entries by (MileagePurpose,
// yyyy-mm of tripDate). Counts trips, sums miles, sums
// reimbursable cents (personal vehicle × IRS rate). Tracks
// the trend on each activity over time — does SUPPLY_RUN
// windshield time creep up in summer? Does BID_WALK
// concentrate in Q1 budget season?
//
// Per row: purpose, month, trips, totalMiles, reimbursableCents,
// distinctEmployees, distinctJobs.
//
// Sort: month asc, totalMiles desc within month.
//
// Different from mileage-by-purpose (lifetime), employee-
// mileage-monthly-by-purpose (per-employee per-purpose per-
// month — too granular for the portfolio view), job-mileage-
// monthly (per-job axis).
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface MileageByPurposeMonthlyRow {
  purpose: MileagePurpose;
  month: string;
  trips: number;
  totalMiles: number;
  reimbursableCents: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface MileageByPurposeMonthlyRollup {
  purposesConsidered: number;
  monthsConsidered: number;
  totalTrips: number;
  totalMiles: number;
  reimbursableCents: number;
}

export interface MileageByPurposeMonthlyInputs {
  mileage: MileageEntry[];
  /** Optional yyyy-mm bounds inclusive applied to tripDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildMileageByPurposeMonthly(
  inputs: MileageByPurposeMonthlyInputs,
): {
  rollup: MileageByPurposeMonthlyRollup;
  rows: MileageByPurposeMonthlyRow[];
} {
  type Acc = {
    purpose: MileagePurpose;
    month: string;
    trips: number;
    miles: number;
    reimb: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const purposes = new Set<MileagePurpose>();
  const months = new Set<string>();

  let totalTrips = 0;
  let totalMiles = 0;
  let reimbursableCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const m of inputs.mileage) {
    const month = m.tripDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;
    const purpose: MileagePurpose = m.purpose ?? 'JOBSITE_TRAVEL';
    const key = `${purpose}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        purpose,
        month,
        trips: 0,
        miles: 0,
        reimb: 0,
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;

    a.trips += 1;
    a.miles += m.businessMiles;
    a.reimb += reimb;
    a.employees.add(m.employeeId);
    if (m.jobId) a.jobs.add(m.jobId);

    purposes.add(purpose);
    months.add(month);
    totalTrips += 1;
    totalMiles += m.businessMiles;
    reimbursableCents += reimb;
  }

  const rows: MileageByPurposeMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      purpose: a.purpose,
      month: a.month,
      trips: a.trips,
      totalMiles: a.miles,
      reimbursableCents: a.reimb,
      distinctEmployees: a.employees.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      if (x.month !== y.month) return x.month.localeCompare(y.month);
      return y.totalMiles - x.totalMiles;
    });

  return {
    rollup: {
      purposesConsidered: purposes.size,
      monthsConsidered: months.size,
      totalTrips,
      totalMiles,
      reimbursableCents,
    },
    rows,
  };
}
