// Per-employee dispatch utilization (show-up rate).
//
// Plain English: of all the working days in the period, how many
// did each employee actually show up on a dispatch? This is a
// coarser cousin to crew-utilization (which is hours-based). Useful
// for spotting employees who keep getting pulled off jobs or aren't
// being scheduled.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Employee } from './employee';

export interface DispatchUtilizationRow {
  employeeId: string;
  employeeName: string;
  /** Distinct (jobId, scheduledFor) pairs the employee was dispatched
   *  to in the period. */
  dispatchedDays: number;
  /** Distinct dispatched dates. */
  distinctDates: number;
  /** distinctDates / workdaysInPeriod. */
  showUpRate: number;
}

export interface DispatchUtilizationReport {
  start: string;
  end: string;
  workdaysInPeriod: number;
  rows: DispatchUtilizationRow[];
  blendedShowUpRate: number;
}

export interface DispatchUtilizationInputs {
  start: string;
  end: string;
  employees: Employee[];
  dispatches: Dispatch[];
}

export function buildDispatchUtilization(
  inputs: DispatchUtilizationInputs,
): DispatchUtilizationReport {
  const { start, end, employees, dispatches } = inputs;
  const workdays = countWorkdays(start, end);

  // Index employee names for fallback display.
  const nameById = new Map<string, string>();
  for (const e of employees) {
    nameById.set(e.id, `${e.firstName} ${e.lastName}`);
  }

  type Bucket = {
    name: string;
    pairs: Set<string>; // (jobId|date)
    dates: Set<string>;
  };
  const byEmployee = new Map<string, Bucket>();

  for (const d of dispatches) {
    if (d.scheduledFor < start || d.scheduledFor > end) continue;
    if (d.status === 'CANCELLED' || d.status === 'DRAFT') continue;
    for (const m of d.crew ?? []) {
      const id = m.employeeId ?? `name:${m.name.trim().toLowerCase()}`;
      const b =
        byEmployee.get(id) ??
        ({
          name: nameById.get(id) ?? m.name,
          pairs: new Set<string>(),
          dates: new Set<string>(),
        } as Bucket);
      b.pairs.add(`${d.jobId}|${d.scheduledFor}`);
      b.dates.add(d.scheduledFor);
      byEmployee.set(id, b);
    }
  }

  const rows: DispatchUtilizationRow[] = [];
  let totalDates = 0;
  for (const [id, b] of byEmployee) {
    rows.push({
      employeeId: id,
      employeeName: b.name,
      dispatchedDays: b.pairs.size,
      distinctDates: b.dates.size,
      showUpRate: workdays === 0 ? 0 : b.dates.size / workdays,
    });
    totalDates += b.dates.size;
  }

  // Worst show-up rate first (lowest first).
  rows.sort((a, b) => a.showUpRate - b.showUpRate);

  return {
    start,
    end,
    workdaysInPeriod: workdays,
    rows,
    blendedShowUpRate:
      rows.length === 0 || workdays === 0
        ? 0
        : totalDates / (rows.length * workdays),
  };
}

function countWorkdays(start: string, end: string): number {
  const s = Date.parse(`${start}T00:00:00Z`);
  const e = Date.parse(`${end}T00:00:00Z`);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let count = 0;
  for (let t = s; t <= e; t += ONE_DAY) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}
