// Job-anchored per-impact-level weather detail snapshot.
//
// Plain English: for one job, return one row per weather impact
// level (NONE, PARTIAL, STOPPED): log count, total lost hours,
// T8 §3395 heat-trigger days, high-heat trigger days, last log
// date. Sorted by lost hours desc.
//
// Pure derivation. No persisted records.

import type { WeatherLog } from './weather-log';

import {
  shouldActivateHeatProcedures,
  shouldActivateHighHeatProcedures,
} from './weather-log';

export interface JobWeatherDetailRow {
  impact: string;
  total: number;
  lostHours: number;
  heatTriggerDays: number;
  highHeatTriggerDays: number;
  heatComplianceGaps: number;
  lastLogDate: string | null;
}

export interface JobWeatherDetailSnapshotResult {
  asOf: string;
  jobId: string;
  rows: JobWeatherDetailRow[];
}

export interface JobWeatherDetailSnapshotInputs {
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

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildJobWeatherDetailSnapshot(
  inputs: JobWeatherDetailSnapshotInputs,
): JobWeatherDetailSnapshotResult {
  const asOf = inputs.asOf ?? todayIso();

  type Acc = {
    total: number;
    lostHours: number;
    heatDays: number;
    highHeatDays: number;
    gaps: number;
    lastDate: string | null;
  };
  const byImpact = new Map<string, Acc>();
  function getAcc(impact: string): Acc {
    let a = byImpact.get(impact);
    if (!a) {
      a = { total: 0, lostHours: 0, heatDays: 0, highHeatDays: 0, gaps: 0, lastDate: null };
      byImpact.set(impact, a);
    }
    return a;
  }

  for (const w of inputs.weatherLogs) {
    if (w.jobId !== inputs.jobId) continue;
    if (w.observedOn > asOf) continue;
    const a = getAcc(w.impact);
    a.total += 1;
    a.lostHours += w.lostHours;
    const heat = shouldActivateHeatProcedures(w);
    const highHeat = shouldActivateHighHeatProcedures(w);
    if (heat) a.heatDays += 1;
    if (highHeat) a.highHeatDays += 1;
    if ((heat && !w.heatProceduresActivated) || (highHeat && !w.highHeatProceduresActivated)) a.gaps += 1;
    if (a.lastDate == null || w.observedOn > a.lastDate) a.lastDate = w.observedOn;
  }

  const rows: JobWeatherDetailRow[] = [...byImpact.entries()]
    .map(([impact, a]) => ({
      impact,
      total: a.total,
      lostHours: round2(a.lostHours),
      heatTriggerDays: a.heatDays,
      highHeatTriggerDays: a.highHeatDays,
      heatComplianceGaps: a.gaps,
      lastLogDate: a.lastDate,
    }))
    .sort((a, b) => b.lostHours - a.lostHours || a.impact.localeCompare(b.impact));

  return {
    asOf,
    jobId: inputs.jobId,
    rows,
  };
}
