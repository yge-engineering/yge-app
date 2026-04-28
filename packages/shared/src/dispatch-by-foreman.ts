// Per-foreman dispatch activity.
//
// Plain English: foreman-throughput already covers daily-report-
// based crew throughput. This is the dispatch-side picture: across
// every POSTED + COMPLETED dispatch, how many days each foreman
// ran a crew, how many distinct jobs they touched, how big their
// crews were on average, when they last ran a dispatch.
//
// Per row: foremanName, dispatches, distinctDates, distinctJobs,
// crewLines, avgCrewSize, equipmentLines, lastDispatchDate.
//
// Sort by dispatches desc.
//
// Different from foreman-scorecard (DR paperwork habits),
// foreman-throughput (DR-based crew throughput),
// job-dispatch-summary (per-job, not per-foreman).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchByForemanRow {
  foremanName: string;
  dispatches: number;
  distinctDates: number;
  distinctJobs: number;
  crewLines: number;
  avgCrewSize: number;
  equipmentLines: number;
  lastDispatchDate: string | null;
}

export interface DispatchByForemanRollup {
  foremenConsidered: number;
  totalDispatches: number;
}

export interface DispatchByForemanInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildDispatchByForeman(
  inputs: DispatchByForemanInputs,
): {
  rollup: DispatchByForemanRollup;
  rows: DispatchByForemanRow[];
} {
  type Acc = {
    display: string;
    dispatches: number;
    dates: Set<string>;
    jobs: Set<string>;
    crewLines: number;
    equipmentLines: number;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  let total = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    if (!d.foremanName.trim()) continue;
    total += 1;
    const key = d.foremanName.trim().toLowerCase();
    const acc = accs.get(key) ?? {
      display: d.foremanName.trim(),
      dispatches: 0,
      dates: new Set<string>(),
      jobs: new Set<string>(),
      crewLines: 0,
      equipmentLines: 0,
      lastDate: null,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    acc.jobs.add(d.jobId);
    acc.crewLines += d.crew.length;
    acc.equipmentLines += d.equipment.length;
    if (!acc.lastDate || d.scheduledFor > acc.lastDate) acc.lastDate = d.scheduledFor;
    accs.set(key, acc);
  }

  const rows: DispatchByForemanRow[] = [];
  for (const acc of accs.values()) {
    const avgCrew = acc.dispatches === 0
      ? 0
      : Math.round((acc.crewLines / acc.dispatches) * 100) / 100;
    rows.push({
      foremanName: acc.display,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctJobs: acc.jobs.size,
      crewLines: acc.crewLines,
      avgCrewSize: avgCrew,
      equipmentLines: acc.equipmentLines,
      lastDispatchDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => b.dispatches - a.dispatches);

  return {
    rollup: {
      foremenConsidered: rows.length,
      totalDispatches: total,
    },
    rows,
  };
}
