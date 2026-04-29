// Per (job, weather condition) summary.
//
// Plain English: for each job, count weather observations by
// condition (CLEAR / RAIN / WIND / SNOW / etc.) and sum lost
// hours. Useful for the "what specific conditions hit this
// jobsite the hardest" cut.
//
// Per row: jobId, condition, observations, totalLostHours,
// stoppedDays, partialImpactDays.
//
// Sort: jobId asc, totalLostHours desc within job.
//
// Different from weather-monthly-mix (per-month, no job axis),
// weather-job-monthly (per-job per-month, no condition axis),
// weather-lost-hours (per-job summary).
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherLog } from './weather-log';

export interface WeatherConditionByJobRow {
  jobId: string;
  condition: WeatherCondition;
  observations: number;
  totalLostHours: number;
  stoppedDays: number;
  partialImpactDays: number;
}

export interface WeatherConditionByJobRollup {
  jobsConsidered: number;
  conditionsConsidered: number;
  totalEntries: number;
  totalLostHours: number;
}

export interface WeatherConditionByJobInputs {
  weatherLogs: WeatherLog[];
  /** Optional yyyy-mm-dd window applied to observedOn. */
  fromDate?: string;
  toDate?: string;
}

export function buildWeatherConditionByJob(
  inputs: WeatherConditionByJobInputs,
): {
  rollup: WeatherConditionByJobRollup;
  rows: WeatherConditionByJobRow[];
} {
  type Acc = {
    jobId: string;
    condition: WeatherCondition;
    observations: number;
    lost: number;
    stopped: number;
    partial: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const conditionSet = new Set<WeatherCondition>();
  let totalEntries = 0;
  let totalLost = 0;

  for (const w of inputs.weatherLogs) {
    if (inputs.fromDate && w.observedOn < inputs.fromDate) continue;
    if (inputs.toDate && w.observedOn > inputs.toDate) continue;
    const key = `${w.jobId}|${w.primaryCondition}`;
    const acc = accs.get(key) ?? {
      jobId: w.jobId,
      condition: w.primaryCondition,
      observations: 0,
      lost: 0,
      stopped: 0,
      partial: 0,
    };
    acc.observations += 1;
    acc.lost += w.lostHours;
    if (w.impact === 'STOPPED') acc.stopped += 1;
    else if (w.impact === 'PARTIAL') acc.partial += 1;
    accs.set(key, acc);
    jobSet.add(w.jobId);
    conditionSet.add(w.primaryCondition);
    totalEntries += 1;
    totalLost += w.lostHours;
  }

  const rows: WeatherConditionByJobRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      condition: acc.condition,
      observations: acc.observations,
      totalLostHours: Math.round(acc.lost * 100) / 100,
      stoppedDays: acc.stopped,
      partialImpactDays: acc.partial,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.totalLostHours - a.totalLostHours;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      conditionsConsidered: conditionSet.size,
      totalEntries,
      totalLostHours: Math.round(totalLost * 100) / 100,
    },
    rows,
  };
}
