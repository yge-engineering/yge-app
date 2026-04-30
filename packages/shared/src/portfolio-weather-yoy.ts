// Portfolio weather log year-over-year.
//
// Plain English: collapse two years of weather logs into a
// comparison row with totals, condition + impact mix, lost
// hours, distinct jobs + deltas. Sized for the bid-day
// adjustment review (CA winter vs summer working days).
//
// Different from portfolio-weather-monthly (per month).
//
// Pure derivation. No persisted records.

import type {
  WeatherCondition,
  WeatherImpact,
  WeatherLog,
} from './weather-log';

export interface PortfolioWeatherYoyResult {
  priorYear: number;
  currentYear: number;
  priorTotal: number;
  priorTotalLostHours: number;
  priorByCondition: Partial<Record<WeatherCondition, number>>;
  priorByImpact: Partial<Record<WeatherImpact, number>>;
  priorDistinctJobs: number;
  currentTotal: number;
  currentTotalLostHours: number;
  currentByCondition: Partial<Record<WeatherCondition, number>>;
  currentByImpact: Partial<Record<WeatherImpact, number>>;
  currentDistinctJobs: number;
  totalLostHoursDelta: number;
}

export interface PortfolioWeatherYoyInputs {
  weatherLogs: WeatherLog[];
  currentYear: number;
}

export function buildPortfolioWeatherYoy(
  inputs: PortfolioWeatherYoyInputs,
): PortfolioWeatherYoyResult {
  const priorYear = inputs.currentYear - 1;

  type Bucket = {
    total: number;
    lostHours: number;
    byCondition: Map<WeatherCondition, number>;
    byImpact: Map<WeatherImpact, number>;
    jobs: Set<string>;
  };
  function emptyBucket(): Bucket {
    return {
      total: 0,
      lostHours: 0,
      byCondition: new Map(),
      byImpact: new Map(),
      jobs: new Set(),
    };
  }
  const prior = emptyBucket();
  const current = emptyBucket();

  for (const w of inputs.weatherLogs) {
    const year = Number(w.observedOn.slice(0, 4));
    let b: Bucket | null = null;
    if (year === priorYear) b = prior;
    else if (year === inputs.currentYear) b = current;
    if (!b) continue;
    b.total += 1;
    b.lostHours += w.lostHours ?? 0;
    const cond: WeatherCondition = w.primaryCondition ?? 'CLEAR';
    b.byCondition.set(cond, (b.byCondition.get(cond) ?? 0) + 1);
    const imp: WeatherImpact = w.impact ?? 'NONE';
    b.byImpact.set(imp, (b.byImpact.get(imp) ?? 0) + 1);
    b.jobs.add(w.jobId);
  }

  function condRecord(m: Map<WeatherCondition, number>): Partial<Record<WeatherCondition, number>> {
    const out: Partial<Record<WeatherCondition, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }
  function impactRecord(m: Map<WeatherImpact, number>): Partial<Record<WeatherImpact, number>> {
    const out: Partial<Record<WeatherImpact, number>> = {};
    for (const [k, v] of m) out[k] = v;
    return out;
  }

  return {
    priorYear,
    currentYear: inputs.currentYear,
    priorTotal: prior.total,
    priorTotalLostHours: prior.lostHours,
    priorByCondition: condRecord(prior.byCondition),
    priorByImpact: impactRecord(prior.byImpact),
    priorDistinctJobs: prior.jobs.size,
    currentTotal: current.total,
    currentTotalLostHours: current.lostHours,
    currentByCondition: condRecord(current.byCondition),
    currentByImpact: impactRecord(current.byImpact),
    currentDistinctJobs: current.jobs.size,
    totalLostHoursDelta: current.lostHours - prior.lostHours,
  };
}
