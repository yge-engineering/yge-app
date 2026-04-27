// Toolbox-talk compliance report — Cal/OSHA T8 §1509.
//
// Plain English: California Code of Regulations, Title 8, §1509 says
// every construction employer with 10+ employees in any one trade
// must hold a tailgate safety meeting at least every 10 working days.
// Cal/OSHA inspectors ask for the records.
//
// This walks toolbox-talk records over a date range and answers two
// questions:
//   1. Did we miss the 10-working-day cadence at any point in the
//      window? (compliance check)
//   2. Who keeps missing meetings? (per-attendee participation)
//
// Pure derivation. No persisted records.
//
// Working-day counting: Mon-Fri only. Phase 1 doesn't subtract
// federal holidays — Cal/OSHA hasn't published a holiday-exempt
// rule, and contractors typically just hold the meeting the next
// working day if a holiday lands inside the window.

import type { ToolboxTalk } from './toolbox-talk';

/** Per-window compliance check — one window per 10-working-day span
 *  starting from the period start. */
export interface ToolboxComplianceWindow {
  /** Start of the 10-working-day window (yyyy-mm-dd, inclusive). */
  windowStart: string;
  /** End of the window (yyyy-mm-dd, inclusive). */
  windowEnd: string;
  /** How many talks fell in this window. */
  talksHeld: number;
  /** True iff at least one talk fell in the window. */
  compliant: boolean;
}

export interface ToolboxComplianceAttendeeRow {
  /** Best identifier we have. employeeId when YGE employee, otherwise
   *  the printed name. */
  attendeeKey: string;
  /** Display name. */
  name: string;
  /** Number of meetings attended in the period. */
  meetingsAttended: number;
  /** meetingsAttended / totalTalks. */
  attendanceRate: number;
}

export interface ToolboxComplianceReport {
  start: string;
  end: string;
  workingDays: number;
  /** Count of HELD or SUBMITTED talks dated inside [start, end]. */
  talksHeld: number;
  /** Floor of (workingDays / 10) — minimum talks required to be
   *  compliant for the period. */
  talksRequired: number;
  /** True iff talksHeld >= talksRequired AND no 10-workday window
   *  inside the period went without a talk. */
  compliant: boolean;

  /** Walk of 10-working-day windows. Any non-compliant window is the
   *  exact gap to fix. */
  windows: ToolboxComplianceWindow[];
  nonCompliantWindowCount: number;

  /** Per-attendee participation. Sorted by attendanceRate ascending —
   *  the person who keeps missing surfaces at the top. */
  attendees: ToolboxComplianceAttendeeRow[];
}

export interface ToolboxComplianceInputs {
  /** ISO yyyy-mm-dd inclusive. */
  start: string;
  /** ISO yyyy-mm-dd inclusive. */
  end: string;
  toolboxTalks: ToolboxTalk[];
}

export function buildToolboxComplianceReport(
  inputs: ToolboxComplianceInputs,
): ToolboxComplianceReport {
  const { start, end, toolboxTalks } = inputs;

  // Count HELD + SUBMITTED talks inside the window. DRAFT doesn't count.
  const inWindow = toolboxTalks.filter(
    (t) =>
      (t.status === 'HELD' || t.status === 'SUBMITTED') &&
      t.heldOn >= start &&
      t.heldOn <= end,
  );

  // Sort by date for window walking.
  inWindow.sort((a, b) => a.heldOn.localeCompare(b.heldOn));

  const workingDays = countWorkdaysInclusive(start, end);
  const talksRequired = Math.floor(workingDays / 10);
  const talksHeld = inWindow.length;

  // Walk 10-working-day windows.
  const windows: ToolboxComplianceWindow[] = [];
  let cursor = start;
  while (cursor <= end) {
    const windowEnd = nthWorkdayAfter(cursor, 10, end);
    const heldInside = inWindow.filter(
      (t) => t.heldOn >= cursor && t.heldOn <= windowEnd,
    );
    windows.push({
      windowStart: cursor,
      windowEnd,
      talksHeld: heldInside.length,
      compliant: heldInside.length > 0,
    });
    cursor = nextDay(windowEnd);
    if (cursor > end) break;
  }

  const nonCompliantWindowCount = windows.filter((w) => !w.compliant).length;

  // Per-attendee participation.
  const attendeeMap = new Map<
    string,
    { name: string; count: number }
  >();
  for (const talk of inWindow) {
    for (const a of talk.attendees ?? []) {
      const key = a.employeeId ?? `name:${a.name.toLowerCase().trim()}`;
      const cur = attendeeMap.get(key) ?? { name: a.name, count: 0 };
      cur.count += 1;
      attendeeMap.set(key, cur);
    }
  }
  const totalTalks = inWindow.length;
  const attendees: ToolboxComplianceAttendeeRow[] = Array.from(attendeeMap.entries()).map(
    ([key, { name, count }]) => ({
      attendeeKey: key,
      name,
      meetingsAttended: count,
      attendanceRate: totalTalks === 0 ? 0 : count / totalTalks,
    }),
  );
  attendees.sort((a, b) => a.attendanceRate - b.attendanceRate);

  const compliant =
    talksHeld >= talksRequired && nonCompliantWindowCount === 0;

  return {
    start,
    end,
    workingDays,
    talksHeld,
    talksRequired,
    compliant,
    windows,
    nonCompliantWindowCount,
    attendees,
  };
}

// ---- helpers ------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseUtc(d: string): number {
  return Date.parse(`${d}T00:00:00Z`);
}

function isoFromUtc(t: number): string {
  return new Date(t).toISOString().slice(0, 10);
}

function isWorkday(t: number): boolean {
  const dow = new Date(t).getUTCDay(); // 0 Sun .. 6 Sat
  return dow !== 0 && dow !== 6;
}

function countWorkdaysInclusive(start: string, end: string): number {
  const s = parseUtc(start);
  const e = parseUtc(end);
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  let count = 0;
  for (let t = s; t <= e; t += MS_PER_DAY) {
    if (isWorkday(t)) count += 1;
  }
  return count;
}

/** Return the date `n` working days after `start` (inclusive of
 *  `start` if it's a workday). Capped at `cap`. */
function nthWorkdayAfter(start: string, n: number, cap: string): string {
  const s = parseUtc(start);
  const c = parseUtc(cap);
  if (Number.isNaN(s) || Number.isNaN(c)) return cap;
  let t = s;
  let workdaysSeen = 0;
  let last = t;
  while (t <= c) {
    if (isWorkday(t)) {
      workdaysSeen += 1;
      last = t;
      if (workdaysSeen >= n) return isoFromUtc(t);
    }
    t += MS_PER_DAY;
  }
  return isoFromUtc(last);
}

function nextDay(yyyymmdd: string): string {
  const t = parseUtc(yyyymmdd);
  if (Number.isNaN(t)) return yyyymmdd;
  return isoFromUtc(t + MS_PER_DAY);
}
