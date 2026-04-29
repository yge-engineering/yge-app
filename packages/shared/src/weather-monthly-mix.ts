// Weather monthly mix.
//
// Plain English: bucket weather log entries by yyyy-mm, count by
// primary condition (CLEAR / RAIN / WIND / etc.), and sum lost
// hours + days impacted. Useful for time-extension claims and
// the seasonal planning view.
//
// Per row: month, total, byCondition, totalLostHours,
// stoppedDays, partialImpactDays, heatActivatedDays,
// distinctJobs.
//
// Sort by month asc.
//
// Different from weather-lost-hours (per-job lost hours summary),
// heat-illness-audit (T8 §3395 audit). This is the time-axis
// portfolio view.
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherLog } from './weather-log';

export interface WeatherMonthlyMixRow {
  month: string;
  total: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  totalLostHours: number;
  stoppedDays: number;
  partialImpactDays: number;
  heatActivatedDays: number;
  distinctJobs: number;
}

export interface WeatherMonthlyMixRollup {
  monthsConsidered: number;
  totalEntries: number;
  totalLostHours: number;
  totalStoppedDays: number;
}

export interface WeatherMonthlyMixInputs {
  weatherLogs: WeatherLog[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildWeatherMonthlyMix(
  inputs: WeatherMonthlyMixInputs,
): {
  rollup: WeatherMonthlyMixRollup;
  rows: WeatherMonthlyMixRow[];
} {
  type Bucket = {
    month: string;
    total: number;
    byCondition: Map<WeatherCondition, number>;
    lostHours: number;
    stoppedDays: number;
    partialDays: number;
    heatDays: number;
    jobs: Set<string>;
  };
  const fresh = (month: string): Bucket => ({
    month,
    total: 0,
    byCondition: new Map<WeatherCondition, number>(),
    lostHours: 0,
    stoppedDays: 0,
    partialDays: 0,
    heatDays: 0,
    jobs: new Set<string>(),
  });
  const buckets = new Map<string, Bucket>();

  for (const w of inputs.weatherLogs) {
    const month = w.observedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? fresh(month);
    b.total += 1;
    b.byCondition.set(w.primaryCondition, (b.byCondition.get(w.primaryCondition) ?? 0) + 1);
    b.lostHours += w.lostHours;
    if (w.impact === 'STOPPED') b.stoppedDays += 1;
    else if (w.impact === 'PARTIAL') b.partialDays += 1;
    if (w.heatProceduresActivated) b.heatDays += 1;
    b.jobs.add(w.jobId);
    buckets.set(month, b);
  }

  const rows: WeatherMonthlyMixRow[] = Array.from(buckets.values())
    .map((b) => {
      const obj: Partial<Record<WeatherCondition, number>> = {};
      for (const [k, v] of b.byCondition.entries()) obj[k] = v;
      return {
        month: b.month,
        total: b.total,
        byCondition: obj,
        totalLostHours: Math.round(b.lostHours * 100) / 100,
        stoppedDays: b.stoppedDays,
        partialImpactDays: b.partialDays,
        heatActivatedDays: b.heatDays,
        distinctJobs: b.jobs.size,
      };
    })
    .sort((a, b) => a.month.localeCompare(b.month));

  let totalEntries = 0;
  let totalLost = 0;
  let totalStopped = 0;
  for (const r of rows) {
    totalEntries += r.total;
    totalLost += r.totalLostHours;
    totalStopped += r.stoppedDays;
  }

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalEntries,
      totalLostHours: Math.round(totalLost * 100) / 100,
      totalStoppedDays: totalStopped,
    },
    rows,
  };
}
