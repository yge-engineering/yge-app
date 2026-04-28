// Per-job weather observation gap detector.
//
// Plain English: time-extension claims under CA Greenbook §6-1.06,
// Caltrans Std. Spec. §8-1.07, and most state/agency contracts
// require a daily-by-daily weather log to support the claim. If
// you don't have a weather row for the day in question, the
// claim usually loses.
//
// This module walks all calendar days inside [fromDate, toDate]
// for one job and surfaces:
//   - days with no WeatherLog row (gap)
//   - days where impact > NONE was logged but no lostHours captured
//   - days where heat-illness procedures should have been triggered
//     by the temperature but the boolean wasn't set
//
// Pure derivation. Uses only string-based date math to avoid
// timezone surprises.

import type { WeatherLog } from './weather-log';

export type WeatherGapKind =
  | 'MISSING_OBSERVATION'
  | 'IMPACT_WITHOUT_LOST_HOURS'
  | 'HEAT_TRIGGER_NOT_FLAGGED';

export interface WeatherGap {
  date: string;
  kind: WeatherGapKind;
  description: string;
}

export interface JobWeatherGapsReport {
  jobId: string;
  fromDate: string;
  toDate: string;
  daysConsidered: number;
  daysWithObservation: number;
  observationCoverage: number;
  gaps: WeatherGap[];
  /** Days that should have triggered heat-illness procedures
   *  (highF >= 80) — count only. */
  heatTriggerDays: number;
  /** Subset of heatTriggerDays where flag wasn't set. */
  heatTriggerMisses: number;
}

export interface JobWeatherGapsInputs {
  jobId: string;
  fromDate: string;
  toDate: string;
  weatherLogs: WeatherLog[];
  /** Skip weekends (Saturday + Sunday) when checking for missing
   *  observations. Default false — many ag-fire jobs run weekends. */
  skipWeekends?: boolean;
}

export function buildJobWeatherGaps(inputs: JobWeatherGapsInputs): JobWeatherGapsReport {
  const skipWeekends = inputs.skipWeekends === true;

  // Filter WeatherLog to job + window.
  const inWindow = inputs.weatherLogs
    .filter((w) => w.jobId === inputs.jobId)
    .filter((w) => w.observedOn >= inputs.fromDate && w.observedOn <= inputs.toDate);

  // Index by date for fast lookup.
  const byDate = new Map<string, WeatherLog>();
  for (const w of inWindow) {
    byDate.set(w.observedOn, w);
  }

  const gaps: WeatherGap[] = [];

  // Walk every day in the window.
  let cursor = inputs.fromDate;
  let daysConsidered = 0;
  let daysWithObservation = 0;
  let heatTriggerDays = 0;
  let heatTriggerMisses = 0;

  while (cursor <= inputs.toDate) {
    if (skipWeekends && isWeekend(cursor)) {
      cursor = addDaysIso(cursor, 1);
      continue;
    }
    daysConsidered += 1;
    const log = byDate.get(cursor);
    if (!log) {
      gaps.push({
        date: cursor,
        kind: 'MISSING_OBSERVATION',
        description: `No weather observation logged for ${cursor}.`,
      });
    } else {
      daysWithObservation += 1;

      // IMPACT_WITHOUT_LOST_HOURS — claimed impact but no hours.
      if (log.impact !== 'NONE' && log.lostHours <= 0) {
        gaps.push({
          date: cursor,
          kind: 'IMPACT_WITHOUT_LOST_HOURS',
          description: `Weather impact = ${log.impact} on ${cursor} but lostHours is 0 — won't carry a delay claim.`,
        });
      }

      // HEAT_TRIGGER_NOT_FLAGGED — T8 §3395 requires procedures at >=80°F.
      if (typeof log.highF === 'number' && log.highF >= 80) {
        heatTriggerDays += 1;
        if (!log.heatProceduresActivated) {
          heatTriggerMisses += 1;
          gaps.push({
            date: cursor,
            kind: 'HEAT_TRIGGER_NOT_FLAGGED',
            description: `High of ${log.highF}°F on ${cursor} but heat-illness procedures weren't flagged (T8 §3395).`,
          });
        }
      }
    }
    cursor = addDaysIso(cursor, 1);
  }

  // Stable sort: by date asc, then by kind asc.
  gaps.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.kind.localeCompare(b.kind);
  });

  const observationCoverage = daysConsidered === 0
    ? 0
    : Math.round((daysWithObservation / daysConsidered) * 10_000) / 10_000;

  return {
    jobId: inputs.jobId,
    fromDate: inputs.fromDate,
    toDate: inputs.toDate,
    daysConsidered,
    daysWithObservation,
    observationCoverage,
    gaps,
    heatTriggerDays,
    heatTriggerMisses,
  };
}

// ---- Date helpers --------------------------------------------------------

function addDaysIso(iso: string, n: number): string {
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function isWeekend(iso: string): boolean {
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const dow = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return dow === 0 || dow === 6;
}
