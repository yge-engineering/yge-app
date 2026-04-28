// Dispatch volume by day of week.
//
// Plain English: across the whole dispatch history, what's the
// volume by day of week? Most heavy civil work is Monday-Friday,
// but Saturday make-up days happen on rain-delay catch-up and
// some agencies pay weekend premium for night/closure work.
// This shows the actual rhythm — useful for crew planning and
// surfacing under-utilized days that could absorb scope.
//
// Per row: dayOfWeek (0=Sunday..6=Saturday), label, dispatches,
// distinctDates, distinctJobs, totalCrewLines, avgCrewSize,
// totalEquipmentLines.
//
// Sorted Monday-first (Mon, Tue, Wed, Thu, Fri, Sat, Sun).
//
// Different from dispatch-monthly-volume (per month),
// dispatch-by-foreman (per foreman), and dispatch-utilization
// (per employee).
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';

export interface DispatchByDayOfWeekRow {
  dayOfWeek: number;
  label: string;
  dispatches: number;
  distinctDates: number;
  distinctJobs: number;
  totalCrewLines: number;
  avgCrewSize: number;
  totalEquipmentLines: number;
}

export interface DispatchByDayOfWeekRollup {
  daysConsidered: number;
  totalDispatches: number;
}

export interface DispatchByDayOfWeekInputs {
  dispatches: Dispatch[];
  /** Optional yyyy-mm-dd window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

const LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SORT_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-first

export function buildDispatchByDayOfWeek(
  inputs: DispatchByDayOfWeekInputs,
): {
  rollup: DispatchByDayOfWeekRollup;
  rows: DispatchByDayOfWeekRow[];
} {
  type Acc = {
    dispatches: number;
    dates: Set<string>;
    jobs: Set<string>;
    crew: number;
    equipment: number;
  };
  const accs = new Map<number, Acc>();
  let total = 0;

  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    const dow = dayOfWeekUtc(d.scheduledFor);
    if (dow < 0) continue;
    total += 1;
    const acc = accs.get(dow) ?? {
      dispatches: 0,
      dates: new Set<string>(),
      jobs: new Set<string>(),
      crew: 0,
      equipment: 0,
    };
    acc.dispatches += 1;
    acc.dates.add(d.scheduledFor);
    acc.jobs.add(d.jobId);
    acc.crew += d.crew.length;
    acc.equipment += d.equipment.length;
    accs.set(dow, acc);
  }

  const rows: DispatchByDayOfWeekRow[] = [];
  for (const dow of SORT_ORDER) {
    const acc = accs.get(dow);
    if (!acc) continue;
    const avgCrew = acc.dispatches === 0
      ? 0
      : Math.round((acc.crew / acc.dispatches) * 100) / 100;
    rows.push({
      dayOfWeek: dow,
      label: LABELS[dow] ?? '',
      dispatches: acc.dispatches,
      distinctDates: acc.dates.size,
      distinctJobs: acc.jobs.size,
      totalCrewLines: acc.crew,
      avgCrewSize: avgCrew,
      totalEquipmentLines: acc.equipment,
    });
  }

  return {
    rollup: {
      daysConsidered: rows.length,
      totalDispatches: total,
    },
    rows,
  };
}

function dayOfWeekUtc(ymd: string): number {
  const t = Date.parse(ymd + 'T00:00:00Z');
  if (Number.isNaN(t)) return -1;
  return new Date(t).getUTCDay();
}
