// Per (customer, month) daily report rollup.
//
// Plain English: join daily reports to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of date).
// Counts DRs, distinct dates, distinct foremen, crew-days,
// total photoCount. Sized for the customer-side documentation
// audit ("show me every DR you filed on our jobs in Q1").
//
// "crewDays" = sum of crewOnSite.length across the bucket.
//
// Per row: customerName, month, drs, distinctDates,
// distinctForemen, crewDays, photoCount, distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from job-dr-monthly (per job axis), dr-monthly-
// volume (portfolio per month), dr-by-foreman-monthly (per
// foreman axis).
//
// Pure derivation. No persisted records.

import type { DailyReport } from './daily-report';
import type { Job } from './job';

export interface CustomerDailyReportMonthlyRow {
  customerName: string;
  month: string;
  drs: number;
  distinctDates: number;
  distinctForemen: number;
  crewDays: number;
  photoCount: number;
  distinctJobs: number;
}

export interface CustomerDailyReportMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalDrs: number;
  totalCrewDays: number;
  totalPhotoCount: number;
  unattributed: number;
}

export interface CustomerDailyReportMonthlyInputs {
  dailyReports: DailyReport[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to date. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerDailyReportMonthly(
  inputs: CustomerDailyReportMonthlyInputs,
): {
  rollup: CustomerDailyReportMonthlyRollup;
  rows: CustomerDailyReportMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    drs: number;
    dates: Set<string>;
    foremen: Set<string>;
    jobs: Set<string>;
    crewDays: number;
    photoCount: number;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalDrs = 0;
  let totalCrewDays = 0;
  let totalPhotoCount = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const dr of inputs.dailyReports) {
    const month = dr.date.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(dr.jobId);
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
        drs: 0,
        dates: new Set(),
        foremen: new Set(),
        jobs: new Set(),
        crewDays: 0,
        photoCount: 0,
      };
      accs.set(key, a);
    }
    a.drs += 1;
    a.dates.add(dr.date);
    a.foremen.add(dr.foremanId);
    a.jobs.add(dr.jobId);
    a.crewDays += (dr.crewOnSite ?? []).length;
    a.photoCount += dr.photoCount ?? 0;

    customers.add(cKey);
    months.add(month);
    totalDrs += 1;
    totalCrewDays += (dr.crewOnSite ?? []).length;
    totalPhotoCount += dr.photoCount ?? 0;
  }

  const rows: CustomerDailyReportMonthlyRow[] = [...accs.values()]
    .map((a) => ({
      customerName: a.customerName,
      month: a.month,
      drs: a.drs,
      distinctDates: a.dates.size,
      distinctForemen: a.foremen.size,
      crewDays: a.crewDays,
      photoCount: a.photoCount,
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
      totalDrs,
      totalCrewDays,
      totalPhotoCount,
      unattributed,
    },
    rows,
  };
}
