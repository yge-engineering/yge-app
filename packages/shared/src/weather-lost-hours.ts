// Weather lost-hours summary.
//
// Plain English: when weather shuts down crews, the contract usually
// allows time-extension claims (CO time, no money). To file the
// extension you need a clean record of which days were lost, what
// the weather was, and how many crew-hours got eaten. This walks
// the weather log over a date range and rolls it up.
//
// Pure derivation. No persisted records.

import type { WeatherCondition, WeatherImpact, WeatherLog } from './weather-log';

export interface WeatherLostHoursJobRow {
  jobId: string;
  daysObserved: number;
  daysWithImpact: number;
  daysStopped: number;
  daysPartial: number;
  totalLostHours: number;
  /** Primary-condition tally so the delay narrative can lead with
   *  the right villain. */
  byCondition: Partial<Record<WeatherCondition, number>>;
}

export interface WeatherLostHoursSummary {
  start: string;
  end: string;
  daysObserved: number;
  totalLostHours: number;
  byJob: WeatherLostHoursJobRow[];
  byImpact: Record<WeatherImpact, number>;
  byCondition: Partial<Record<WeatherCondition, number>>;
}

export interface WeatherLostHoursInputs {
  start: string;
  end: string;
  weatherLog: WeatherLog[];
}

export function buildWeatherLostHoursSummary(
  inputs: WeatherLostHoursInputs,
): WeatherLostHoursSummary {
  const { start, end, weatherLog } = inputs;

  const inWindow = weatherLog.filter(
    (w) => w.observedOn >= start && w.observedOn <= end,
  );

  type Bucket = {
    daysObserved: number;
    daysWithImpact: number;
    daysStopped: number;
    daysPartial: number;
    totalLostHours: number;
    byCondition: Partial<Record<WeatherCondition, number>>;
  };
  const byJob = new Map<string, Bucket>();

  let totalLostHours = 0;
  const byImpact: Record<WeatherImpact, number> = {
    NONE: 0,
    PARTIAL: 0,
    STOPPED: 0,
  };
  const byCondition: Partial<Record<WeatherCondition, number>> = {};

  for (const w of inWindow) {
    const b =
      byJob.get(w.jobId) ??
      ({
        daysObserved: 0,
        daysWithImpact: 0,
        daysStopped: 0,
        daysPartial: 0,
        totalLostHours: 0,
        byCondition: {},
      } as Bucket);
    b.daysObserved += 1;
    if (w.impact === 'STOPPED') {
      b.daysStopped += 1;
      b.daysWithImpact += 1;
    } else if (w.impact === 'PARTIAL') {
      b.daysPartial += 1;
      b.daysWithImpact += 1;
    }
    b.totalLostHours += w.lostHours;
    b.byCondition[w.primaryCondition] =
      (b.byCondition[w.primaryCondition] ?? 0) + 1;
    byJob.set(w.jobId, b);

    totalLostHours += w.lostHours;
    byImpact[w.impact] += 1;
    byCondition[w.primaryCondition] =
      (byCondition[w.primaryCondition] ?? 0) + 1;
  }

  const rows: WeatherLostHoursJobRow[] = [];
  for (const [jobId, b] of byJob) {
    rows.push({
      jobId,
      daysObserved: b.daysObserved,
      daysWithImpact: b.daysWithImpact,
      daysStopped: b.daysStopped,
      daysPartial: b.daysPartial,
      totalLostHours: b.totalLostHours,
      byCondition: b.byCondition,
    });
  }
  rows.sort((a, b) => b.totalLostHours - a.totalLostHours);

  return {
    start,
    end,
    daysObserved: inWindow.length,
    totalLostHours,
    byJob: rows,
    byImpact,
    byCondition,
  };
}
