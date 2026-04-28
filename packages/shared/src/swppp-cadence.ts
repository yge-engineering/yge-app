// Per-job SWPPP inspection cadence audit.
//
// California's Construction General Permit (CGP, Order 2009-0009-DWQ
// as amended) requires the QSP/QSD to inspect BMPs:
//   - WEEKLY (minimum) during the rainy season
//   - 24 HOURS BEFORE each forecast qualifying rain event
//   - DURING each qualifying rain event (every 24 hours actively
//     discharging)
//   - 48 HOURS AFTER each qualifying rain event
//
// Missing any of these is a $10,000/day-per-violation exposure with
// the State Water Resources Control Board. This module scans the
// recorded inspections + weather logs for one job and surfaces:
//   - weeks during the audit window with no weekly inspection
//   - storm events (≥ 0.50" in WeatherLog) with no within-24-hours
//     pre-storm or post-storm inspection
//
// Pure derivation. No persisted records.

import type { SwpppInspection } from './swppp-inspection';
import type { WeatherLog } from './weather-log';

/** Default qualifying-storm threshold per the CGP — 0.50". */
export const QUALIFYING_STORM_HUNDREDTHS = 50;

export type SwpppGapKind =
  | 'MISSED_WEEKLY'
  | 'MISSED_PRE_STORM'
  | 'MISSED_POST_STORM';

export interface SwpppCadenceGap {
  kind: SwpppGapKind;
  /** yyyy-mm-dd anchor date for the gap. For weekly gaps it's the
   *  Monday of the week. For storm gaps it's the storm date. */
  anchorDate: string;
  /** Detail string suitable for the UI. */
  description: string;
}

export interface SwpppCadenceReport {
  jobId: string;
  fromDate: string;
  toDate: string;
  inspectionsConsidered: number;
  weeksConsidered: number;
  weeksWithInspection: number;
  qualifyingStorms: number;
  stormsWithPreInspection: number;
  stormsWithPostInspection: number;
  gaps: SwpppCadenceGap[];
}

export interface SwpppCadenceInputs {
  jobId: string;
  /** Inclusive yyyy-mm-dd audit window. */
  fromDate: string;
  toDate: string;
  inspections: SwpppInspection[];
  weatherLogs: WeatherLog[];
  /** Override the qualifying-storm threshold (hundredths of an
   *  inch). Default 50 (0.50"). */
  qualifyingStormHundredths?: number;
}

export function buildSwpppCadence(inputs: SwpppCadenceInputs): SwpppCadenceReport {
  const threshold = inputs.qualifyingStormHundredths ?? QUALIFYING_STORM_HUNDREDTHS;

  // Window-filter to this job + window.
  const inspections = inputs.inspections
    .filter((i) => i.jobId === inputs.jobId)
    .filter((i) => i.inspectedOn >= inputs.fromDate && i.inspectedOn <= inputs.toDate);

  const weather = inputs.weatherLogs
    .filter((w) => w.jobId === inputs.jobId)
    .filter((w) => w.observedOn >= inputs.fromDate && w.observedOn <= inputs.toDate);

  // Pre-index inspections by date for fast lookup.
  const inspectionDates = new Set<string>(inspections.map((i) => i.inspectedOn));

  const gaps: SwpppCadenceGap[] = [];

  // -------- Weekly cadence --------
  // Walk Mondays from fromDate to toDate. Each Monday anchors a
  // calendar week. If there's no inspection in [Mon, Sun], it's a
  // missed weekly.
  const weekMondays = mondaysBetween(inputs.fromDate, inputs.toDate);
  let weeksWithInspection = 0;
  for (const monday of weekMondays) {
    const sunday = addDaysIso(monday, 6);
    const sundayClamped = sunday > inputs.toDate ? inputs.toDate : sunday;
    const hit = inspections.some(
      (i) => i.inspectedOn >= monday && i.inspectedOn <= sundayClamped,
    );
    if (hit) {
      weeksWithInspection += 1;
    } else {
      gaps.push({
        kind: 'MISSED_WEEKLY',
        anchorDate: monday,
        description: `No SWPPP inspection logged for week of ${monday}.`,
      });
    }
  }

  // -------- Pre/post-storm cadence --------
  // A "qualifying storm" = a WeatherLog row with precip >= threshold.
  let stormsWithPre = 0;
  let stormsWithPost = 0;
  const storms = weather.filter(
    (w) =>
      typeof w.precipHundredthsInch === 'number' &&
      w.precipHundredthsInch >= threshold,
  );

  for (const storm of storms) {
    const stormDate = storm.observedOn;
    // Pre-storm window: 24 hours BEFORE the storm. We allow inspections
    // on stormDate-1 OR stormDate (same day pre-event).
    const dayBefore = addDaysIso(stormDate, -1);
    const hasPre = inspectionDates.has(dayBefore) ||
      inspections.some((i) =>
        i.inspectedOn === stormDate && i.trigger === 'PRE_STORM',
      );
    if (hasPre) {
      stormsWithPre += 1;
    } else {
      gaps.push({
        kind: 'MISSED_PRE_STORM',
        anchorDate: stormDate,
        description: `No pre-storm SWPPP inspection within 24 hours before ${stormDate}.`,
      });
    }

    // Post-storm window: within 48 hours AFTER the storm ends. We
    // accept inspections on stormDate, +1, or +2.
    const day1 = addDaysIso(stormDate, 1);
    const day2 = addDaysIso(stormDate, 2);
    const hasPost = inspections.some((i) =>
      [stormDate, day1, day2].includes(i.inspectedOn) &&
      (i.trigger === 'POST_STORM' || i.trigger === 'DURING_STORM'),
    );
    if (hasPost) {
      stormsWithPost += 1;
    } else {
      gaps.push({
        kind: 'MISSED_POST_STORM',
        anchorDate: stormDate,
        description: `No post-storm SWPPP inspection within 48 hours after ${stormDate}.`,
      });
    }
  }

  // Sort gaps by anchorDate asc, then by kind for deterministic output.
  gaps.sort((a, b) => {
    if (a.anchorDate !== b.anchorDate) return a.anchorDate.localeCompare(b.anchorDate);
    return a.kind.localeCompare(b.kind);
  });

  return {
    jobId: inputs.jobId,
    fromDate: inputs.fromDate,
    toDate: inputs.toDate,
    inspectionsConsidered: inspections.length,
    weeksConsidered: weekMondays.length,
    weeksWithInspection,
    qualifyingStorms: storms.length,
    stormsWithPreInspection: stormsWithPre,
    stormsWithPostInspection: stormsWithPost,
    gaps,
  };
}

// ---- Date helpers --------------------------------------------------------
// Pure string-based date math against yyyy-mm-dd. Avoids new Date()
// timezone surprises that have bitten us before.

function addDaysIso(iso: string, n: number): string {
  // Use UTC to avoid local-time DST shifts.
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayOfWeekUtc(iso: string): number {
  // 0 = Sunday ... 6 = Saturday
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const year = parts[0] ?? 0;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/** All Monday-anchored week starts that overlap [fromDate, toDate]. */
function mondaysBetween(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  // Find the Monday on or before fromDate.
  const fromDow = dayOfWeekUtc(fromDate);
  // JS getUTCDay: 0=Sun..6=Sat. Convert to 0=Mon..6=Sun.
  const mondayOffset = (fromDow + 6) % 7;
  let cursor = addDaysIso(fromDate, -mondayOffset);
  while (cursor <= toDate) {
    out.push(cursor);
    cursor = addDaysIso(cursor, 7);
  }
  return out;
}
