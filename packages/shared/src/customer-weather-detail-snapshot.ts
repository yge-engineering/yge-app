// Customer-anchored per-job weather detail snapshot.
//
// Plain English: for one customer (matched via Job.ownerAgency),
// return one row per job with weather log totals, impacted days,
// total lost hours, T8 §3395 heat / high-heat trigger days, last
// log date. Sorted by total lost hours desc.
//
// Pure derivation. No persisted records.

import type { Job } from './job';
import type { WeatherLog } from './weather-log';

import {
  shouldActivateHeatProcedures,
  shouldActivateHighHeatProcedures,
} from './weather-log';

export interface CustomerWeatherDetailRow {
  jobId: string;
  total: number;
  impactedDays: number;
  stoppedDays: number;
  lostHours: number;
  heatTriggerDays: number;
  highHeatTriggerDays: number;
  lastLogDate: string | null;
}

export interface CustomerWeatherDetailSnapshotResult {
  asOf: string;
  customerName: string;
  rows: CustomerWeatherDetailRow[];
}

export interface CustomerWeatherDetailSnapshotInputs {
  customerName: string;
  jobs: Job[];
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

function norm(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildCustomerWeatherDetailSnapshot(
  inputs: CustomerWeatherDetailSnapshotInputs,
): CustomerWeatherDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();
  const target = norm(inputs.customerName);

  const customerJobs = new Set<string>();
  for (const j of inputs.jobs) {
    if (norm(j.ownerAgency) === target) customerJobs.add(j.id);
  }

  type Acc = {
    total: number;
    impacted: number;
    stopped: number;
    lostHours: number;
    heatDays: number;
    highHeatDays: number;
    lastDate: string | null;
  };
  const byJob = new Map<string, Acc>();
  function getAcc(jobId: string): Acc {
    let a = byJob.get(jobId);
    if (!a) {
      a = { total: 0, impacted: 0, stopped: 0, lostHours: 0, heatDays: 0, highHeatDays: 0, lastDate: null };
      byJob.set(jobId, a);
    }
    return a;
  }

  for (const w of inputs.weatherLogs) {
    if (!customerJobs.has(w.jobId)) continue;
    if (w.observedOn > asOf) continue;
    const a = getAcc(w.jobId);
    a.total += 1;
    if (w.impact !== 'NONE') a.impacted += 1;
    if (w.impact === 'STOPPED') a.stopped += 1;
    a.lostHours += w.lostHours;
    if (shouldActivateHeatProcedures(w)) a.heatDays += 1;
    if (shouldActivateHighHeatProcedures(w)) a.highHeatDays += 1;
    if (a.lastDate == null || w.observedOn > a.lastDate) a.lastDate = w.observedOn;
  }

  const rows: CustomerWeatherDetailRow[] = [...byJob.entries()]
    .map(([jobId, a]) => ({
      jobId,
      total: a.total,
      impactedDays: a.impacted,
      stoppedDays: a.stopped,
      lostHours: round2(a.lostHours),
      heatTriggerDays: a.heatDays,
      highHeatTriggerDays: a.highHeatDays,
      lastLogDate: a.lastDate,
    }))
    .sort((a, b) => b.lostHours - a.lostHours || a.jobId.localeCompare(b.jobId));

  return {
    asOf,
    customerName: inputs.customerName,
    rows,
  };
}
