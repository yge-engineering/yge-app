// Per-employee toolbox-talk attendance gap.
//
// Plain English: Cal/OSHA T8 §1509 requires every employer (10+
// trade workers) to hold a tailgate/toolbox safety meeting at
// least once every 10 working days, and every employee in the
// crew is expected to attend. The toolbox-compliance module
// covers whether the talks were HELD; this module flips the
// question: which employees personally missed talks in the
// window?
//
// Walks attendees on submitted talks (HELD or SUBMITTED). For
// each ACTIVE employee:
//   - count of talks attended (signed=true)
//   - total talks held in window
//   - days since last attended talk
//   - tier: CURRENT / DUE_SOON / OVERDUE / NEVER
//
// Pure derivation. No persisted records.

import type { Employee } from './employee';
import type { ToolboxTalk } from './toolbox-talk';

export type AttendanceFlag =
  | 'CURRENT'    // attended within last 14 days
  | 'DUE_SOON'   // 14-21 days since last talk
  | 'OVERDUE'    // 21+ days since last attended (or 10 working days per §1509)
  | 'NEVER';     // employee never attended a talk in the window

export interface AttendanceGapRow {
  employeeId: string;
  employeeName: string;
  classification: string | null;
  attendedCount: number;
  /** Most recent heldOn date the employee attended. Null if never. */
  lastAttendedOn: string | null;
  daysSinceLastAttended: number | null;
  flag: AttendanceFlag;
}

export interface AttendanceGapRollup {
  employeesConsidered: number;
  talksInWindow: number;
  current: number;
  dueSoon: number;
  overdue: number;
  never: number;
}

export interface AttendanceGapInputs {
  /** Inclusive yyyy-mm-dd window. */
  fromDate: string;
  toDate: string;
  employees: Employee[];
  toolboxTalks: ToolboxTalk[];
}

export function buildToolboxAttendanceGap(
  inputs: AttendanceGapInputs,
): {
  rollup: AttendanceGapRollup;
  rows: AttendanceGapRow[];
} {
  const refNow = new Date(`${inputs.toDate}T00:00:00Z`);

  // Walk talks in window, build (employeeId → list of attendance dates).
  const attendedByEmp = new Map<string, string[]>();
  let talksInWindow = 0;
  for (const t of inputs.toolboxTalks) {
    if (t.heldOn < inputs.fromDate || t.heldOn > inputs.toDate) continue;
    if (t.status === 'DRAFT') continue;
    talksInWindow += 1;
    for (const a of t.attendees ?? []) {
      if (!a.employeeId) continue;
      if (!a.signed) continue;
      const list = attendedByEmp.get(a.employeeId) ?? [];
      list.push(t.heldOn);
      attendedByEmp.set(a.employeeId, list);
    }
  }

  // Walk ACTIVE employees, classify each.
  const rows: AttendanceGapRow[] = [];
  const counts = { current: 0, dueSoon: 0, overdue: 0, never: 0 };
  for (const e of inputs.employees) {
    if (e.status !== 'ACTIVE') continue;
    const attended = attendedByEmp.get(e.id) ?? [];
    let lastAttendedOn: string | null = null;
    for (const d of attended) {
      if (!lastAttendedOn || d > lastAttendedOn) lastAttendedOn = d;
    }
    const daysSince = lastAttendedOn
      ? Math.max(0, daysBetween(parseDate(lastAttendedOn) ?? refNow, refNow))
      : null;
    const flag = classify(daysSince);

    rows.push({
      employeeId: e.id,
      employeeName: `${e.firstName} ${e.lastName}`.trim(),
      classification: e.classification ?? null,
      attendedCount: attended.length,
      lastAttendedOn,
      daysSinceLastAttended: daysSince,
      flag,
    });

    if (flag === 'CURRENT') counts.current += 1;
    else if (flag === 'DUE_SOON') counts.dueSoon += 1;
    else if (flag === 'OVERDUE') counts.overdue += 1;
    else counts.never += 1;
  }

  // NEVER first (worst), then OVERDUE, DUE_SOON, CURRENT;
  // days-since desc within tier.
  const tierRank: Record<AttendanceFlag, number> = {
    NEVER: 0,
    OVERDUE: 1,
    DUE_SOON: 2,
    CURRENT: 3,
  };
  rows.sort((a, b) => {
    if (a.flag !== b.flag) return tierRank[a.flag] - tierRank[b.flag];
    const ad = a.daysSinceLastAttended ?? Infinity;
    const bd = b.daysSinceLastAttended ?? Infinity;
    return bd - ad;
  });

  return {
    rollup: {
      employeesConsidered: rows.length,
      talksInWindow,
      current: counts.current,
      dueSoon: counts.dueSoon,
      overdue: counts.overdue,
      never: counts.never,
    },
    rows,
  };
}

function classify(daysSince: number | null): AttendanceFlag {
  if (daysSince === null) return 'NEVER';
  if (daysSince <= 14) return 'CURRENT';
  if (daysSince <= 21) return 'DUE_SOON';
  return 'OVERDUE';
}

function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}
