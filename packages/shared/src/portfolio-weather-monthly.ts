// Portfolio weather log activity by month.
//
// Plain English: per yyyy-mm of observedOn, count weather entries,
// total lost hours, condition mix, impact mix, distinct jobs.
// Drives the time-extension claim package and the seasonal
// weather-loss trend.
//
// Per row: month, total, totalLostHours, byCondition, byImpact,
// distinctJobs.
//
// Sort: month asc.
//
// Different from weather-monthly-mix (no impact axis),
// weather-job-monthly (per job axis), customer-weather-monthly
// (per customer).
//
// Pure derivation. No persisted records.

import type {
  WeatherCondition,
  WeatherImpact,
  WeatherLog,
} from './weather-log';

export interface PortfolioWeatherMonthlyRow {
  month: string;
  total: number;
  totalLostHours: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  byImpact: Partial<Record<WeatherImpact, number>>;
  distinctJobs: number;
}

export interface PortfolioWeatherMonthlyRollup {
  monthsConsidered: number;
  totalEntries: number;
  totalLostHours: number;
}

export interface PortfolioWeatherMonthlyInputs {
  weatherLogs: WeatherLog[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildPortfolioWeatherMonthly(
  inputs: PortfolioWeatherMonthlyInputs,
): {
  rollup: PortfolioWeatherMonthlyRollup;
  rows: PortfolioWeatherMonthlyRow[];
} {
  type Acc = {
    month: string;
    total: number;
    lostHours: number;
    byCondition: Map<WeatherCondition, number>;
    byImpact: Map<WeatherImpact, number>;
    jobs: Set<string>;
  };
  const accs = new Map<string, Acc>();

  let totalEntries = 0;
  let totalLostHours = 0;

  const fromM = inputs.fromMonth;
  const toM = inputs.toMonth;

  for (const w of inputs.weatherLogs) {
    const month = w.observedOn.slice(0, 7);
    if (fromM && month < fromM) continue;
    if (toM && month > toM) continue;

    let a = accs.get(month);
    if (!a) {
      a = {
        month,
        total: 0,
        lostHours: 0,
        byCondition: new Map(),
        byImpact: new Map(),
        jobs: new Set(),
      };
      accs.set(month, a);
    }
    a.total += 1;
    a.lostHours += w.lostHours ?? 0;
    const cond: WeatherCondition = w.primaryCondition ?? 'CLEAR';
    a.byCondition.set(cond, (a.byCondition.get(cond) ?? 0) + 1);
    const imp: WeatherImpact = w.impact ?? 'NONE';
    a.byImpact.set(imp, (a.byImpact.get(imp) ?? 0) + 1);
    a.jobs.add(w.jobId);
    totalEntries += 1;
    totalLostHours += w.lostHours ?? 0;
  }

  const rows: PortfolioWeatherMonthlyRow[] = [...accs.values()]
    .map((a) => {
      const byCondition: Partial<Record<WeatherCondition, number>> = {};
      for (const [k, v] of a.byCondition) byCondition[k] = v;
      const byImpact: Partial<Record<WeatherImpact, number>> = {};
      for (const [k, v] of a.byImpact) byImpact[k] = v;
      return {
        month: a.month,
        total: a.total,
        totalLostHours: a.lostHours,
        byCondition,
        byImpact,
        distinctJobs: a.jobs.size,
      };
    })
    .sort((x, y) => x.month.localeCompare(y.month));

  return {
    rollup: { monthsConsidered: rows.length, totalEntries, totalLostHours },
    rows,
  };
}
