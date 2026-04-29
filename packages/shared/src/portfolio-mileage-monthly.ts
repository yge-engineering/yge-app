// Portfolio mileage activity by month with purpose mix.
//
// Plain English: per yyyy-mm of tripDate, count trips, sum
// business miles + IRS-rate reimbursable cents, distinct
// employees + jobs, and break trips down by MileagePurpose.
// Drives the "how much windshield time across the company"
// trend.
//
// Per row: month, trips, totalMiles, reimbursableCents,
// byPurpose, distinctEmployees, distinctJobs.
//
// Sort: month asc.
//
// Different from mileage-by-purpose-monthly (per purpose row),
// employee-mileage-monthly (per employee axis), job-mileage-
// monthly (per job axis), customer-mileage-monthly (per
// customer).
//
// Pure derivation. No persisted records.

import type { MileageEntry, MileagePurpose } from './mileage';

export interface PortfolioMileageMonthlyRow {
  month: string;
  trips: number;
  totalMiles: number;
  reimbursableCents: number;
  byPurpose: Partial<Record<MileagePurpose, number>>;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface PortfolioMileageMonthlyRollup {
  monthsConsidered: number;
  totalTrips: number;
  totalMiles: number;
  reimbursableCents: number;
}

export interface PortfolioMileageMonthlyInputs {
  mileage: MileageEntry[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioMileageMonthly(
  inputs: PortfolioMileageMonthlyInputs,
): {
  rollup: PortfolioMileageMonthlyRollup;
  rows: PortfolioMileageMonthlyRow[];
} {
  type Acc = {
    month: string;
    trips: number;
    miles: number;
    reimb: number;
    byPurpose: Map<MileagePurpose, number>;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalTrips = 0;
  let totalMiles = 0;
  let reimbursableCents = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const m of inputs.mileage) {
    const month = m.tripDate.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        trips: 0,
        miles: 0,
        reimb: 0,
        byPurpose: new Map(),
        employees: new Set(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    const reimb = m.isPersonalVehicle && m.irsRateCentsPerMile
      ? Math.round(m.businessMiles * m.irsRateCentsPerMile)
      : 0;
    a.trips += 1;
    a.miles += m.businessMiles;
    a.reimb += reimb;
    const purpose: MileagePurpose = m.purpose ?? 'JOBSITE_TRAVEL';
    a.byPurpose.set(purpose, (a.byPurpose.get(purpose) ?? 0) + 1);
    a.employees.add(m.employeeId);
    if (m.jobId) a.jobs.add(m.jobId);

    totalTrips += 1;
    totalMiles += m.businessMiles;
    reimbursableCents += reimb;
  }

  const rows: PortfolioMileageMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byPurpose: Partial<Record<MileagePurpose, number>> = {};
      for (const [k, v] of a.byPurpose) byPurpose[k] = v;
      return {
        month: a.month,
        trips: a.trips,
        totalMiles: a.miles,
        reimbursableCents: a.reimb,
        byPurpose,
        distinctEmployees: a.employees.size,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalTrips,
      totalMiles,
      reimbursableCents,
    },
    rows,
  };
}
