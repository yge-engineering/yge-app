// Job-anchored weather snapshot.
//
// Plain English: for one job, as-of today, count weather logs,
// sum lost hours, break down by primary condition + impact,
// surface heat trigger / compliance gap counts, last log date.
// Drives the right-now per-job weather + heat-safety overview.
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherImpact, WeatherLog } from './weather-log';

import { heatComplianceGap, shouldActivateHeatProcedures, shouldActivateHighHeatProcedures } from './weather-log';

export interface JobWeatherSnapshotResult {
  asOf: string;
  jobId: string;
  totalLogs: number;
  totalLostHours: number;
  impactedDays: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  byImpact: Partial<Record<WeatherImpact, number>>;
  heatTriggerDays: number;
  highHeatTriggerDays: number;
  heatComplianceGaps: number;
  lastLogDate: string | null;
}

export interface JobWeatherSnapshotInputs {
  jobId: string;
  weatherLogs: WeatherLog[];
  /** ISO yyyy-mm-dd. Defaults to today (UTC). */
  asOf?: string;
}

function todayIso(): string {
  const d = new Date();
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function buildJobWeatherSnapshot(
  inputs: JobWeatherSnapshotInputs,
): JobWeatherSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  const byCondition = new Map<WeatherCondition, number>();
  const byImpact = new Map<WeatherImpact, number>();

  let totalLogs = 0;
  let totalLostHours = 0;
  let impactedDays = 0;
  let heatTriggerDays = 0;
  let highHeatTriggerDays = 0;
  let heatComplianceGaps = 0;
  let lastLogDate: string | null = null;

  for (const w of inputs.weatherLogs) {
    if (w.jobId !== inputs.jobId) continue;
    if (w.observedOn > asOf) continue;
    totalLogs += 1;
    totalLostHours += w.lostHours ?? 0;
    if (w.impact && w.impact !== 'NONE') impactedDays += 1;
    byCondition.set(w.primaryCondition, (byCondition.get(w.primaryCondition) ?? 0) + 1);
    byImpact.set(w.impact, (byImpact.get(w.impact) ?? 0) + 1);
    if (shouldActivateHeatProcedures(w)) heatTriggerDays += 1;
    if (shouldActivateHighHeatProcedures(w)) highHeatTriggerDays += 1;
    const gap = heatComplianceGap(w);
    if (gap.missingHeatActivation || gap.missingHighHeatActivation) heatComplianceGaps += 1;
    if (lastLogDate == null || w.observedOn > lastLogDate) lastLogDate = w.observedOn;
  }

  const cOut: Partial<Record<WeatherCondition, number>> = {};
  for (const [k, v] of byCondition) cOut[k] = v;
  const iOut: Partial<Record<WeatherImpact, number>> = {};
  for (const [k, v] of byImpact) iOut[k] = v;

  return {
    asOf,
    jobId: inputs.jobId,
    totalLogs,
    totalLostHours,
    impactedDays,
    byCondition: cOut,
    byImpact: iOut,
    heatTriggerDays,
    highHeatTriggerDays,
    heatComplianceGaps,
    lastLogDate,
  };
}
