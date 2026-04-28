// Per-employee dispatch streak.
//
// Plain English: for each ACTIVE employee, walk the dispatch
// roster history and compute the longest consecutive run of
// working days the employee was dispatched (Mon-Fri counted),
// the current streak ending at asOf, and days-since-last-
// dispatch. Useful for spotting employees coming off a long
// run (rest needed) or who haven't been used recently
// (assignment drought).
//
// Different from dispatch-utilization (per-employee show-up
// rate) and employee-dr-appearances (DR-based). This is the
// dispatch-board streak view.
//
// Pure derivation. No persisted records.

import type { Dispatch } from './dispatch';
import type { Employee } from './employee';

export interface EmployeeDispatchStreakRow {
  employeeId: string;
  employeeName: string;
  totalDispatchDays: number;
  longestStreak: number;
  currentStreak: number;
  lastDispatchDate: string | null;
  daysSinceLastDispatch: number | null;
}

export interface EmployeeDispatchStreakRollup {
  employeesConsidered: number;
  totalDispatchDays: number;
  /** Employees with no dispatch in the window. */
  noDispatchCount: number;
}

export interface EmployeeDispatchStreakInputs {
  employees: Employee[];
  dispatches: Dispatch[];
  /** asOf yyyy-mm-dd. Defaults to latest scheduledFor. */
  asOf?: string;
  /** Default false — only ACTIVE employees scored. */
  includeInactive?: boolean;
  /** Inclusive window applied to scheduledFor. */
  fromDate?: string;
  toDate?: string;
}

export function buildEmployeeDispatchStreak(
  inputs: EmployeeDispatchStreakInputs,
): {
  rollup: EmployeeDispatchStreakRollup;
  rows: EmployeeDispatchStreakRow[];
} {
  const includeInactive = inputs.includeInactive === true;
  const employees = inputs.employees.filter((e) =>
    includeInactive ? true : e.status === 'ACTIVE',
  );

  let asOf = inputs.asOf;
  if (!asOf) {
    let latest = '';
    for (const d of inputs.dispatches) {
      if (d.scheduledFor > latest) latest = d.scheduledFor;
    }
    asOf = latest || '1970-01-01';
  }

  // Per-employee set of distinct dispatched dates (only POSTED + COMPLETED).
  const datesByEmp = new Map<string, Set<string>>();
  for (const d of inputs.dispatches) {
    if (d.status !== 'POSTED' && d.status !== 'COMPLETED') continue;
    if (inputs.fromDate && d.scheduledFor < inputs.fromDate) continue;
    if (inputs.toDate && d.scheduledFor > inputs.toDate) continue;
    for (const member of d.crew) {
      if (!member.employeeId) continue;
      const set = datesByEmp.get(member.employeeId) ?? new Set<string>();
      set.add(d.scheduledFor);
      datesByEmp.set(member.employeeId, set);
    }
  }

  let totalDispatchDays = 0;
  let noDispatch = 0;

  const rows: EmployeeDispatchStreakRow[] = employees.map((e) => {
    const set = datesByEmp.get(e.id);
    if (!set || set.size === 0) {
      noDispatch += 1;
      return {
        employeeId: e.id,
        employeeName: nameOf(e),
        totalDispatchDays: 0,
        longestStreak: 0,
        currentStreak: 0,
        lastDispatchDate: null,
        daysSinceLastDispatch: null,
      };
    }
    const sorted = Array.from(set).sort();
    let longest = 1;
    let run = 1;
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1];
      const cur = sorted[i];
      if (!prev || !cur) continue;
      if (consecutiveWorkingDays(prev, cur)) {
        run += 1;
        if (run > longest) longest = run;
      } else {
        run = 1;
      }
    }
    const last = sorted[sorted.length - 1] ?? '';
    const daysSince = last ? daysBetween(last, asOf) : null;
    // Current streak: walk back from asOf and count contiguous working days
    let currentStreak = 0;
    if (last && daysSince !== null && daysSince <= 3) {
      currentStreak = 1;
      for (let i = sorted.length - 2; i >= 0; i--) {
        const prev = sorted[i];
        const next = sorted[i + 1];
        if (!prev || !next) break;
        if (consecutiveWorkingDays(prev, next)) {
          currentStreak += 1;
        } else {
          break;
        }
      }
    }

    totalDispatchDays += sorted.length;
    return {
      employeeId: e.id,
      employeeName: nameOf(e),
      totalDispatchDays: sorted.length,
      longestStreak: longest,
      currentStreak,
      lastDispatchDate: last || null,
      daysSinceLastDispatch: daysSince,
    };
  });

  // Sort: longest streak first, ties by total dispatch days desc.
  rows.sort((a, b) => {
    if (a.longestStreak !== b.longestStreak) return b.longestStreak - a.longestStreak;
    return b.totalDispatchDays - a.totalDispatchDays;
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      totalDispatchDays,
      noDispatchCount: noDispatch,
    },
    rows,
  };
}

/** True iff `next` is the next working day after `prev` — meaning
 *  the next calendar day, OR Monday after Friday (skip weekend). */
function consecutiveWorkingDays(prev: string, next: string): boolean {
  const oneDay = addDaysIso(prev, 1);
  if (oneDay === next) return true;
  // If prev is Friday (dow 5), Monday (prev+3) counts as next working day.
  if (dayOfWeekUtc(prev) === 5 && addDaysIso(prev, 3) === next) return true;
  return false;
}

function dayOfWeekUtc(iso: string): number {
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  return new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1)).getUTCDay();
}

function addDaysIso(iso: string, n: number): string {
  const parts = iso.split('-').map((p) => Number.parseInt(p, 10));
  const d = new Date(Date.UTC(parts[0] ?? 0, (parts[1] ?? 1) - 1, parts[2] ?? 1));
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const fromParts = fromIso.split('-').map((p) => Number.parseInt(p, 10));
  const toParts = toIso.split('-').map((p) => Number.parseInt(p, 10));
  const a = Date.UTC(fromParts[0] ?? 0, (fromParts[1] ?? 1) - 1, fromParts[2] ?? 1);
  const b = Date.UTC(toParts[0] ?? 0, (toParts[1] ?? 1) - 1, toParts[2] ?? 1);
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function nameOf(e: Employee): string {
  if (e.displayName && e.displayName.trim().length > 0) {
    return `${e.displayName} ${e.lastName}`;
  }
  return `${e.firstName} ${e.lastName}`;
}
