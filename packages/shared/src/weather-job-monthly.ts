// Per-job weather impact by month.
//
// Plain English: bucket weather logs by (jobId, yyyy-mm of
// observedOn) — total entries, lost hours, stopped days, partial
// days, heat-activated days. Useful for the per-job time-extension
// claim packet.
//
// Per row: jobId, month, total, totalLostHours, stoppedDays,
// partialImpactDays, heatActivatedDays.
//
// Sort: jobId asc, month asc.
//
// Different from weather-monthly-mix (portfolio per month, no
// job axis), weather-lost-hours (per-job lost hours summary).
//
// Pure derivation. No persisted records.

import type { WeatherLog } from './weather-log';

export interface WeatherJobMonthlyRow {
  jobId: string;
  month: string;
  total: number;
  totalLostHours: number;
  stoppedDays: number;
  partialImpactDays: number;
  heatActivatedDays: number;
}

export interface WeatherJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalEntries: number;
  totalLostHours: number;
}

export interface WeatherJobMonthlyInputs {
  weatherLogs: WeatherLog[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildWeatherJobMonthly(
  inputs: WeatherJobMonthlyInputs,
): {
  rollup: WeatherJobMonthlyRollup;
  rows: WeatherJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    total: number;
    lostHours: number;
    stopped: number;
    partial: number;
    heat: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalEntries = 0;
  let totalLost = 0;

  for (const w of inputs.weatherLogs) {
    const month = w.observedOn.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${w.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: w.jobId,
      month,
      total: 0,
      lostHours: 0,
      stopped: 0,
      partial: 0,
      heat: 0,
    };
    acc.total += 1;
    acc.lostHours += w.lostHours;
    if (w.impact === 'STOPPED') acc.stopped += 1;
    else if (w.impact === 'PARTIAL') acc.partial += 1;
    if (w.heatProceduresActivated) acc.heat += 1;
    accs.set(key, acc);
    jobSet.add(w.jobId);
    monthSet.add(month);
    totalEntries += 1;
    totalLost += w.lostHours;
  }

  const rows: WeatherJobMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      total: acc.total,
      totalLostHours: Math.round(acc.lostHours * 100) / 100,
      stoppedDays: acc.stopped,
      partialImpactDays: acc.partial,
      heatActivatedDays: acc.heat,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      monthsConsidered: monthSet.size,
      totalEntries,
      totalLostHours: Math.round(totalLost * 100) / 100,
    },
    rows,
  };
}
