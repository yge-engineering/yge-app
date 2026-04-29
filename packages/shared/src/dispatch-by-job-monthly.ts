// Dispatch volume per job, per month.
//
// Plain English: bucket POSTED + COMPLETED dispatches by (jobId,
// yyyy-mm of scheduledFor). Long-format result. Useful for the
// "what was January like on Sulphur Springs" trace.
//
// Per row: jobId, month, dispatches, distinctDates,
// distinctForemen, totalCrewLines, totalEquipmentLines.
//
// Sort: jobId asc, month asc.
//
// Different from job-dispatch-summary (per-job rollup, no month
// axis), dispatch-monthly-volume (per-month, no job axis), and
// dispatch-by-day-of-week (per day-of-week).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchByJobMonthlyRow {
  jobId: string;
  month: string;
  dispatches: number;
  distinctDates: number;
  distinctForemen: number;
  totalCrewLines: number;
  totalEquipmentLines: number;
}

export interface DispatchByJobMonthlyRollup {
  jobsConsidered: number;
  monthsConsidered: number;
  totalDispatches: number;
}

export interface DispatchByJobMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchByJobMonthly(
  inputs: DispatchByJobMonthlyInputs,
): {
  rollup: DispatchByJobMonthlyRollup;
  rows: DispatchByJobMonthlyRow[];
} {
  type Acc = {
    jobId: string;
    month: string;
    dispatches: number;
    dates: Set<string>;
    foremen: Set<string>;
    crew: number;
    equip: number;
  };
  const accs = new Map<string, Acc>();
  const jobSet = new Set<string>();
  const monthSet = new Set<string>();
  let total = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const key = `${d.jobId}|${month}`;
    const acc = accs.get(key) ?? {
      jobId: d.jobId,
      month,
      dispatches: 0,
      dates: new Set<string>(),
      foremen: new Set<string>(),
      crew: 0,
      equip: 0,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    if (d.foremanName.trim()) acc.foremen.add(d.foremanName.trim().toLowerCase());
    acc.crew += d.crew.length;
    acc.equip += d.equipment.length;
    accs.set(key, acc);
    jobSet.add(d.jobId);
    monthSet.add(month);
    total += 1;
  }

  const rows: DispatchByJobMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      jobId: acc.jobId,
      month: acc.month,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctForemen: acc.foremen.size,
      totalCrewLines: acc.crew,
      totalEquipmentLines: acc.equip,
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
      totalDispatches: total,
    },
    rows,
  };
}
