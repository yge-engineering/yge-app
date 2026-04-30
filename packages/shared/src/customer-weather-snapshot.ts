// Customer-anchored weather snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// as-of today, count weather logs across all their jobs, sum
// lost hours, condition + impact mix, heat trigger compliance
// gaps, distinct jobs, last log date.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { WeatherCondition, WeatherImpact, WeatherLog } from './weather-log';

import { heatComplianceGap, shouldActivateHeatProcedures, shouldActivateHighHeatProcedures } from './weather-log';

export interface CustomerWeatherSnapshotResult {
  asOf: string;
  customerName: string;
  totalLogs: number;
  totalLostHours: number;
  impactedDays: number;
  byCondition: Partial<Record<WeatherCondition, number>>;
  byImpact: Partial<Record<WeatherImpact, number>>;
  heatTriggerDays: number;
  highHeatTriggerDays: number;
  heatComplianceGaps: number;
  distinctJobs: number;
  lastLogDate: string | null;
}

export interface CustomerWeatherSnapshotInputs {
  customerName: string;
  weatherLogs: WeatherLog[];
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

export function buildCustomerWeatherSnapshot(
  inputs: CustomerWeatherSnapshotInputs,
): CustomerWeatherSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  const byCondition = new Map<WeatherCondition, number>();
  const byImpact = new Map<WeatherImpact, number>();
  const jobs = new Set<string>();

  let totalLogs = 0;
  let totalLostHours = 0;
  let impactedDays = 0;
  let heatTriggerDays = 0;
  let highHeatTriggerDays = 0;
  let heatComplianceGaps = 0;
  let lastLogDate: string | null = null;

  for (const w of inputs.weatherLogs) {
    if (!customerJobs.has(w.jobId)) continue;
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
    jobs.add(w.jobId);
    if (lastLogDate == null || w.observedOn > lastLogDate) lastLogDate = w.observedOn;
  }

  const cOut: Partial<Record<WeatherCondition, number>> = {};
  for (const [k, v] of byCondition) cOut[k] = v;
  const iOut: Partial<Record<WeatherImpact, number>> = {};
  for (const [k, v] of byImpact) iOut[k] = v;

  return {
    asOf,
    customerName: inputs.customerName,
    totalLogs,
    totalLostHours,
    impactedDays,
    byCondition: cOut,
    byImpact: iOut,
    heatTriggerDays,
    highHeatTriggerDays,
    heatComplianceGaps,
    distinctJobs: jobs.size,
    lastLogDate,
  };
}
