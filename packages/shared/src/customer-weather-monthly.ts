// Per (customer, month) weather impact rollup.
//
// Plain English: join weather logs to customers via Job →
// ownerAgency, then bucket by (customerName, yyyy-mm of
// observedOn). Counts entries, total lost hours, condition mix.
// Useful for the agency-side time-extension claim packet —
// "show me every weather day on Caltrans D2 work in Q1."
//
// Per row: customerName, month, total, totalLostHours, byCondition,
// distinctJobs.
//
// Sort: customerName asc, month asc.
//
// Different from weather-monthly-mix (portfolio per month),
// weather-job-monthly (per job per month), weather-condition-
// by-job (per job per condition).
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { WeatherCondition, WeatherLog } from './weather-log';

export interface CustomerWeatherMonthlyRow {
  customerName: string;
  month: string;
  total: number;
  totalLostHours: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  distinctJobs: number;
}

export interface CustomerWeatherMonthlyRollup {
  customersConsidered: number;
  monthsConsidered: number;
  totalEntries: number;
  totalLostHours: number;
  unattributed: number;
}

export interface CustomerWeatherMonthlyInputs {
  weatherLogs: WeatherLog[];
  jobs: Job[];
  /** Optional yyyy-mm bounds inclusive applied to observedOn. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildCustomerWeatherMonthly(
  inputs: CustomerWeatherMonthlyInputs,
): {
  rollup: CustomerWeatherMonthlyRollup;
  rows: CustomerWeatherMonthlyRow[];
} {
  const jobCustomer = new Map<string, string | undefined>();
  for (const j of inputs.jobs) {
    jobCustomer.set(j.id, j.ownerAgency);
  }

  type Acc = {
    customerName: string;
    month: string;
    total: number;
    lostHours: number;
    byCondition: Map<WeatherCondition, number>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();
  const customers = new Set<string>();
  const months = new Set<string>();

  let totalEntries = 0;
  let totalLostHours = 0;
  let unattributed = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const w of inputs.weatherLogs) {
    const month = w.observedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    const customerName = jobCustomer.get(w.jobId);
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
        total: 0,
        lostHours: 0,
        byCondition: new Map(),
        jobs: new Set(),
      };
      accs.set(key, a);
    }
    a.total += 1;
    a.lostHours += w.lostHours ?? 0;
    const cond: WeatherCondition = w.primaryCondition ?? 'CLEAR';
    a.byCondition.set(cond, (a.byCondition.get(cond) ?? 0) + 1);
    a.jobs.add(w.jobId);

    customers.add(cKey);
    months.add(month);
    totalEntries += 1;
    totalLostHours += w.lostHours ?? 0;
  }

  const rows: CustomerWeatherMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCondition: Partial<Record<WeatherCondition, number>> = {};
      for (const [k, v] of a.byCondition) byCondition[k] = v;
      return {
        customerName: a.customerName,
        month: a.month,
        total: a.total,
        totalLostHours: a.lostHours,
        byCondition,
        distinctJobs: a.jobs.size,
      };
    })
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
      totalLostHours,
      unattributed,
    },
    rows,
  };
}
