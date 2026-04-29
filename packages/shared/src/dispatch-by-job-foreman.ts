// Per (job, foreman) dispatch rollup.
//
// Plain English: bucket dispatches by (jobId, foremanName).
// Long-format. Useful for "which foreman ran how much of which
// job" — drives the foreman-cost-allocation review.
//
// Per row: jobId, foremanName, dispatches, distinctDates,
// totalCrewLines, totalEquipmentLines, lastDispatchDate.
//
// Sort: jobId asc, dispatches desc within job.
//
// Different from job-foreman-assignment (per-job primary
// foreman), foreman-throughput (DR-based), dispatch-by-foreman
// (per-foreman lifetime).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchByJobForemanRow {
  jobId: string;
  foremanName: string;
  dispatches: number;
  distinctDates: number;
  totalCrewLines: number;
  totalEquipmentLines: number;
  lastDispatchDate: string | null;
}

export interface DispatchByJobForemanRollup {
  jobsConsidered: number;
  foremenConsidered: number;
  totalDispatches: number;
}

export interface DispatchByJobForemanInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildDispatchByJobForeman(
  inputs: DispatchByJobForemanInputs,
): {
  rollup: DispatchByJobForemanRollup;
  rows: DispatchByJobForemanRow[];
} {
  type Acc = {
    jobId: string;
    display: string;
    dispatches: number;
    dates: Set<string>;
    crew: number;
    equip: number;
    lastDate: string | null;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const foremanSet = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    if (!d.foremanName.trim()) continue;
    const canonical = d.foremanName.trim().toLowerCase();
    const key = `${d.jobId}|${canonical}`;
    const acc = accs.get(key) ?? {
      jobId: d.jobId,
      display: d.foremanName.trim(),
      dispatches: 0,
      dates: new Set<string>(),
      crew: 0,
      equip: 0,
      lastDate: null,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    acc.crew += d.crew.length;
    acc.equip += d.equipment.length;
    if (!acc.lastDate || d.scheduledFor > acc.lastDate) acc.lastDate = d.scheduledFor;
    accs.set(key, acc);
    jobSet.add(d.jobId);
    foremanSet.add(canonical);
    totalDispatches += 1;
  }

  const rows: DispatchByJobForemanRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      foremanName: acc.display,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      totalCrewLines: acc.crew,
      totalEquipmentLines: acc.equip,
      lastDispatchDate: acc.lastDate,
    });
  }

  rows.sort((a, b) => {
    if (a.jobId !== b.jobId) return a.jobId.localeCompare(b.jobId);
    return b.dispatches - a.dispatches;
  });

  return {
    rollup: {
      jobsConsidered: jobSet.size,
      foremenConsidered: foremanSet.size,
      totalDispatches,
    },
    rows,
  };
}
