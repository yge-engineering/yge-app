// Portfolio weather snapshot.
//
// Plain English: as-of today, count weather logs, sum lost hours,
// break down by primary condition, count distinct jobs, and
// surface heat-illness compliance gaps. Drives the right-now
// weather + heat-safety overview.
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherImpact, WeatherLog } from './weather-log';

import { heatComplianceGap, shouldActivateHeatProcedures, shouldActivateHighHeatProcedures } from './weather-log';

export interface PortfolioWeatherSnapshotResult {
  asOf: string;
  ytdLogYear: number;
  totalLogs: number;
  ytdLogs: number;
  totalLostHours: number;
  impactedDays: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  byImpact: Partial<Record<WeatherImpact, number>>;
  heatTriggerDays: number;
  highHeatTriggerDays: number;
  heatComplianceGaps: number;
  distinctJobs: number;
}

export interface PortfolioWeatherSnapshotInputs {
  weatherLogs: WeatherLog[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
  /** Log year (Jan 1 - Dec 31). Defaults to year of asOf. */
  logYear?: number;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildPortfolioWeatherSnapshot(
  inputs: PortfolioWeatherSnapshotInputs,
): PortfolioWeatherSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const logYear = inputs.logYear ?? Number(asOf.slice(0, 4));

  const byCondition = new Map<WeatherCondition, number>();
  const byImpact = new Map<WeatherImpact, number>();
  const jobs = new Set<string>();

  let totalLogs = 0;
  let ytdLogs = 0;
  let totalLostHours = 0;
  let impactedDays = 0;
  let heatTriggerDays = 0;
  let highHeatTriggerDays = 0;
  let heatComplianceGaps = 0;

  for (const w of inputs.weatherLogs) {
    if (w.observedOn > asOf) continue;
    totalLogs += 1;
    if (Number(w.observedOn.slice(0, 4)) === logYear) ytdLogs += 1;
    totalLostHours += w.lostHours ?? 0;
    if (w.impact && w.impact !== 'NONE') impactedDays += 1;
    byCondition.set(w.primaryCondition, (byCondition.get(w.primaryCondition) ?? 0) + 1);
    byImpact.set(w.impact, (byImpact.get(w.impact) ?? 0) + 1);
    jobs.add(w.jobId);
    if (shouldActivateHeatProcedures(w)) heatTriggerDays += 1;
    if (shouldActivateHighHeatProcedures(w)) highHeatTriggerDays += 1;
    const gap = heatComplianceGap(w);
    if (gap.missingHeatActivation || gap.missingHighHeatActivation) heatComplianceGaps += 1;
  }

  const cOut: Partial<Record<WeatherCondition, number>> = {};
  for (const [k, v] of byCondition) cOut[k] = v;
  const iOut: Partial<Record<WeatherImpact, number>> = {};
  for (const [k, v] of byImpact) iOut[k] = v;

  return {
    asOf,
    ytdLogYear: logYear,
    totalLogs,
    ytdLogs,
    totalLostHours,
    impactedDays,
    byCondition: cOut,
    byImpact: iOut,
    heatTriggerDays,
    highHeatTriggerDays,
    heatComplianceGaps,
    distinctJobs: jobs.size,
  };
}
