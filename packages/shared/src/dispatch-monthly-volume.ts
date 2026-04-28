// Per-month portfolio dispatch volume.
//
// Plain English: for each yyyy-mm bucket of POSTED + COMPLETED
// dispatches, count how many crews went out, distinct foremen,
// distinct jobs, total crew-days deployed, and equipment-days.
//
// Different from:
//   - equipment-daily-dispatch (per-equipment per-day grid)
//   - dispatch-utilization (per-employee show-up rate)
//   - dispatch-vs-dr (DR reconciliation)
//
// This is the simple month-by-month operations volume view.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchMonthlyRow {
  month: string;
  dispatchCount: number;
  distinctForemen: number;
  distinctJobs: number;
  totalCrewDays: number;
  totalEquipmentDays: number;
}

export interface DispatchMonthlyRollup {
  monthsConsidered: number;
  totalDispatches: number;
  /** Latest vs prior month delta in dispatch count. 0 with <2 months. */
  monthOverMonthChange: number;
  /** Month with the highest dispatch count. */
  peakMonth: string | null;
  peakDispatchCount: number;
}

export interface DispatchMonthlyInputs {
  dispatches: Dispatch[];
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchMonthlyVolume(
  inputs: DispatchMonthlyInputs,
): {
  rollup: DispatchMonthlyRollup;
  rows: DispatchMonthlyRow[];
} {
  type Bucket = {
    month: string;
    count: number;
    foremen: Set<string>;
    jobs: Set<string>;
    crewDays: number;
    equipmentDays: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const d of inputs.dispatches) {
    if (d.status === 'DRAFT' || d.status === 'CANCELLED') continue;
    const month = d.scheduledFor.slice(0, 7);
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const b = buckets.get(month) ?? {
      month,
      count: 0,
      foremen: new Set<string>(),
      jobs: new Set<string>(),
      crewDays: 0,
      equipmentDays: 0,
    };
    b.count += 1;
    b.foremen.add(canonicalize(d.foremanName));
    b.jobs.add(d.jobId);
    b.crewDays += d.crew.length;
    b.equipmentDays += d.equipment.length;
    buckets.set(month, b);
  }

  const rows: DispatchMonthlyRow[] = Array.from(buckets.values())
    .map((b) => ({
      month: b.month,
      dispatchCount: b.count,
      distinctForemen: b.foremen.size,
      distinctJobs: b.jobs.size,
      totalCrewDays: b.crewDays,
      totalEquipmentDays: b.equipmentDays,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));

  let peakMonth: string | null = null;
  let peakCount = 0;
  for (const r of rows) {
    if (r.dispatchCount > peakCount) {
      peakCount = r.dispatchCount;
      peakMonth = r.month;
    }
  }

  let mom = 0;
  if (rows.length >= 2) {
    const last = rows[rows.length - 1];
    const prev = rows[rows.length - 2];
    if (last && prev) mom = last.dispatchCount - prev.dispatchCount;
  }

  let totalDispatches = 0;
  for (const r of rows) totalDispatches += r.dispatchCount;

  return {
    rollup: {
      monthsConsidered: rows.length,
      totalDispatches,
      monthOverMonthChange: mom,
      peakMonth,
      peakDispatchCount: peakCount,
    },
    rows,
  };
}

function canonicalize(name: string): string {
  return name.toLowerCase().replace(/\s+/g, ' ').trim();
}
