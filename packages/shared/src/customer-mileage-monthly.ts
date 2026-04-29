// Per (customer, month) mileage rollup.
//
// Plain English: join mileage entries to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// tripDate). Sums miles, IRS-rate reimbursable cents, distinct
// employees + jobs, breaks down by purpose. Drives the
// customer-side travel rebill summary.
//
// Per row: customerName, month, trips, totalMiles,
// reimbursableCents, distinctEmployees, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from job-mileage-monthly (per job axis),
// employee-mileage-monthly (per employee axis), mileage-by-
// purpose-monthly (per purpose axis).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { MileageEntry } from './mileage';

export interface CustomerMileageMonthlyRow {
  customerName: string;
  month: string;
  trips: number;
  totalMiles: number;
  reimbursableCents: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface CustomerMileageMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalTrips: number;
  totalMiles: number;
  reimbursableCents: number;
  unattributed: number;
}

export interface CustomerMileageMonthlyInputs {
  mileage: MileageEntry[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to tripDate. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerMileageMonthly(
  inputs: CustomerMileageMonthlyInputs,
): {
  rollup: CustomerMileageMonthlyRollup;
  rows: CustomerMileageMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    trips: number;
    miles: number;
    reimb: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
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

    const customerName = m.jobId ? jobCustomer.get(m.jobId) : undefined;
    if (!customerName) {
      unattributed += 1;
      continue;
    }
    const cKey = customerName.toLowerCase().trim();
    const key = `${cKey}__${month}`;
    let a = accs.get(key);
    if (!a) {
      a = {
        customerName,
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

    customers.add(cKey);
    months.add(month);
    totalTrips += 1;
    totalMiles += m.businessMiles;
    reimbursableCents += reimb;
  }

  const rows: CustomerMileageMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      trips: a.trips,
      totalMiles: a.miles,
      reimbursableCents: a.reimb,
      distinctEmployees: a.employees.size,
      distinctJobs: a.jobs.size,
    }))
    .sort((x, y) => {
      const cn = x.customerName.localeCompare(y.customerName);
      if (cn !== 0) return cn;
      return x.month.localeCompare(y.month);
    });

  return {
    rollup: {
      customersConsidered: customers.size,
      monthsConsidered: months.size,
      totalTrips,
      totalMiles,
      reimbursableCents,
      unattributed,
    },
    rows,
  };
}
