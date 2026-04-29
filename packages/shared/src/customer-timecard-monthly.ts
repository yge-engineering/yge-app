// Per (customer, month) timecard activity rollup.
//
// Plain English: for every TimeCard's entries[], join the entry's
// jobId to a customer via Job → ownerAgency, then bucket by
// (customerName, yyyy-mm of entry.date). Sums worked hours,
// distinct employees, distinct jobs. Tells YGE how many crew-
// hours each agency client is soaking up month over month —
// drives the labor-burden allocation review.
//
// Per row: customerName, month, entries, totalHours,
// distinctEmployees, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from timecard-by-job-monthly (per job axis),
// timecard-monthly-hours (portfolio per month).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { TimeCard, TimeEntry } from './time-card';
import { entryWorkedHours } from './time-card';

export interface CustomerTimecardMonthlyRow {
  customerName: string;
  month: string;
  entries: number;
  totalHours: number;
  distinctEmployees: number;
  distinctJobs: number;
}

export interface CustomerTimecardMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalEntries: number;
  totalHours: number;
  unattributed: number;
}

export interface CustomerTimecardMonthlyInputs {
  timecards: TimeCard[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to entry.date. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerTimecardMonthly(
  inputs: CustomerTimecardMonthlyInputs,
): {
  rollup: CustomerTimecardMonthlyRollup;
  rows: CustomerTimecardMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    entries: number;
    hours: number;
    employees: Set<string>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalEntries = 0;
  let totalHours = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const tc of inputs.timecards) {
    for (const entry of (tc.entries ?? []) as TimeEntry[]) {
      const month = entry.date.slice(0, 7);
      if (fromM && month < fromM) continue;
      if (toM && month > toM) continue;

      const customerName = jobCustomer.get(entry.jobId);
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
          entries: 0,
          hours: 0,
          employees: new Set(),
          jobs: new Set(),
        };
        accs.set(key, a);
      }
      const hrs = entryWorkedHours(entry);
      a.entries += 1;
      a.hours += hrs;
      a.employees.add(tc.employeeId);
      a.jobs.add(entry.jobId);

      customers.add(cKey);
      months.add(month);
      totalEntries += 1;
      totalHours += hrs;
    }
  }

  const rows: CustomerTimecardMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      entries: a.entries,
      totalHours: Math.round(a.hours * 100) / 100,
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
      totalEntries,
      totalHours: Math.round(totalHours * 100) / 100,
      unattributed,
    },
    rows,
  };
}
