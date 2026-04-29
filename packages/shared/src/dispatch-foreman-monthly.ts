// Per-foreman dispatch activity by month.
//
// Plain English: bucket POSTED + COMPLETED dispatches by
// (foremanName, yyyy-mm). Long-format. Useful for tracing
// individual foreman load over time.
//
// Per row: foremanName, month, dispatches, distinctDates,
// distinctJobs, totalCrewLines, totalEquipmentLines.
//
// Sort: foremanName asc, month asc.
//
// Different from dispatch-by-foreman (per-foreman lifetime),
// dispatch-monthly-volume (portfolio per month, no foreman
// axis).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchForemanMonthlyRow {
  foremanName: string;
  month: string;
  dispatches: number;
  distinctDates: number;
  distinctJobs: number;
  totalCrewLines: number;
  totalEquipmentLines: number;
}

export interface DispatchForemanMonthlyRollup {
  foremenConsidered: number;
  monthsConsidered: number;
  totalDispatches: number;
}

export interface DispatchForemanMonthlyInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm bounds inclusive. */
  fromMonth?: string;
  toMonth?: string;
}

export function buildDispatchForemanMonthly(
  inputs: DispatchForemanMonthlyInputs,
): {
  rollup: DispatchForemanMonthlyRollup;
  rows: DispatchForemanMonthlyRow[];
} {
  type Acc = {
    display: string;
    month: string;
    dispatches: number;
    dates: Set<string>;
    jobs: Set<string>;
    crew: number;
    equip: number;
  };
  const accs = new Map<string, Acc>();
  const foremanSet = new Set<string>();
  const monthSet = new Set<string>();
  let totalDispatches = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (!d.foremanName.trim()) continue;
    const month = d.scheduledFor.slice(0, 7);
    if (month.length < 7) continue;
    if (inputs.fromMonth && month < inputs.fromMonth) continue;
    if (inputs.toMonth && month > inputs.toMonth) continue;
    const canonical = d.foremanName.trim().toLowerCase();
    const key = `${canonical}|${month}`;
    const acc = accs.get(key) ?? {
      display: d.foremanName.trim(),
      month,
      dispatches: 0,
      dates: new Set<string>(),
      jobs: new Set<string>(),
      crew: 0,
      equip: 0,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    acc.jobs.add(d.jobId);
    acc.crew += d.crew.length;
    acc.equip += d.equipment.length;
    accs.set(key, acc);
    foremanSet.add(canonical);
    monthSet.add(month);
    totalDispatches += 1;
  }

  const rows: DispatchForemanMonthlyRow[] = [];
  for (const acc of accs.values()) {
    rows.push({
      foremanName: acc.display,
      month: acc.month,
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctJobs: acc.jobs.size,
      totalCrewLines: acc.crew,
      totalEquipmentLines: acc.equip,
    });
  }

  rows.sort((a, b) => {
    if (a.foremanName !== b.foremanName) return a.foremanName.localeCompare(b.foremanName);
    return a.month.localeCompare(b.month);
  });

  return {
    rollup: {
      foremenConsidered: foremanSet.size,
      monthsConsidered: monthSet.size,
      totalDispatches,
    },
    rows,
  };
}
