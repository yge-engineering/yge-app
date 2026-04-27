// Daily equipment dispatch heatmap.
//
// Plain English: equipment-dispatch-days tells us which units are
// busy across a window. This module flips it to show one row per
// DAY — what was the iron load each morning? Useful for:
//   - planning: "Wednesday already has 11 units out, can we
//     scrape another paver for Thursday?"
//   - estimating: "we average 8 units a day across our active
//     jobs — if the next bid needs 4 more, we're going to need
//     a rental"
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface EquipmentDispatchDailyRow {
  date: string;
  /** Distinct equipment units that appeared on POSTED+COMPLETED
   *  dispatches that day. */
  unitsDispatched: number;
  /** Distinct jobs running that day (proxy for spread). */
  distinctJobs: number;
  /** Total dispatch records (some units may appear on multiple
   *  jobs same day — surfaces split-day moves). */
  dispatchCount: number;
}

export interface EquipmentDispatchDailyRollup {
  daysWithActivity: number;
  /** Highest single-day unit count. */
  peakUnitsDispatched: number;
  peakDate: string | null;
  /** Avg units dispatched per active day. */
  avgUnitsPerActiveDay: number;
}

export interface EquipmentDispatchDailyInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  dispatches: Dispatch[];
  /** When false (default), only POSTED + COMPLETED count. */
  includeDraftDispatches?: boolean;
}

export function buildEquipmentDispatchDaily(
  inputs: EquipmentDispatchDailyInputs,
): {
  rollup: EquipmentDispatchDailyRollup;
  rows: EquipmentDispatchDailyRow[];
} {
  const includeDraft = inputs.includeDraftDispatches === true;

  type Bucket = {
    date: string;
    units: Set<string>;
    jobs: Set<string>;
    dispatchCount: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const d of inputs.dispatches) {
    if (d.scheduledFor < inputs.fromDate) continue;
    if (d.scheduledFor > inputs.toDate) continue;
    if (
      !includeDraft &&
      d.status !== 'POSTED' &&
      d.status !== 'COMPLETED'
    ) continue;

    const b = buckets.get(d.scheduledFor) ?? {
      date: d.scheduledFor,
      units: new Set<string>(),
      jobs: new Set<string>(),
      dispatchCount: 0,
    };
    b.dispatchCount += 1;
    b.jobs.add(d.jobId);
    for (const eq of d.equipment) {
      const key = eq.equipmentId ?? `name:${eq.name.trim().toLowerCase()}`;
      if (key) b.units.add(key);
    }
    buckets.set(d.scheduledFor, b);
  }

  const rows: EquipmentDispatchDailyRow[] = [];
  let peak = 0;
  let peakDate: string | null = null;
  let totalUnits = 0;

  for (const b of buckets.values()) {
    rows.push({
      date: b.date,
      unitsDispatched: b.units.size,
      distinctJobs: b.jobs.size,
      dispatchCount: b.dispatchCount,
    });
    if (b.units.size > peak) {
      peak = b.units.size;
      peakDate = b.date;
    }
    totalUnits += b.units.size;
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  return {
    rollup: {
      daysWithActivity: rows.length,
      peakUnitsDispatched: peak,
      peakDate,
      avgUnitsPerActiveDay:
        rows.length === 0 ? 0 : round1(totalUnits / rows.length),
    },
    rows,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
