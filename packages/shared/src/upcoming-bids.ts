// Upcoming-bid calendar helper.
//
// Plain English: Ryan opens Monday morning and wants to see "I have
// three bids due this week, two next week, plus a Friday opening that
// lands on a state holiday so the agency probably moved it." This
// helper turns a raw list of upcoming bids into the bucketed,
// conflict-flagged shape that drives the dashboard tile.
//
// Pure function, no I/O. Composes the california-holidays helper to
// flag any due dates that fall on weekends / observed holidays — the
// agency *should* have moved them, but if not, an in-person bid at
// 2:00 PM on Memorial Day is going nowhere.

import { isBusinessDay, type CalDate } from './california-holidays';

/** A single upcoming bid as fed in. */
export interface UpcomingBidInput {
  /** Stable id (estimate or draft id). */
  id: string;
  projectName: string;
  /** ISO yyyy-mm-dd — required (without it the bid has no slot). */
  bidDueDate: CalDate;
  ownerAgency?: string;
  /** Computed/known total — surfaced in the row, no math done on it
   *  here. */
  estimatedBidTotalCents?: number;
}

/** Same row with derived fields and bucketing metadata. */
export interface UpcomingBidRow extends UpcomingBidInput {
  /** Days from asOfDate to bidDueDate. Negative = bid is in the past. */
  daysUntilDue: number;
  /** True iff bidDueDate is a CA observed holiday (or a weekend). The
   *  agency *should* have moved it but the planner should double-check. */
  fallsOnNonBusinessDay: boolean;
  /** True when another bid in the same input shares this exact
   *  bidDueDate. Two bids the same day = a logistics decision. */
  sameDayConflict: boolean;
}

export interface UpcomingBidWeek {
  /** Monday of the week, ISO. */
  weekStart: CalDate;
  /** Sunday of the week, ISO. */
  weekEnd: CalDate;
  rows: UpcomingBidRow[];
}

export interface UpcomingBidCalendar {
  /** Ranked rows in chronological order (excluding past). */
  rows: UpcomingBidRow[];
  /** Same rows grouped by ISO week. Empty weeks are dropped. */
  weeks: UpcomingBidWeek[];
  /** Convenience flat counts for tile UI. */
  counts: {
    total: number;
    /** Bids due in the next 7 days (inclusive of today). */
    nextSevenDays: number;
    /** Bids that need a flag for a holiday/weekend due date. */
    nonBusinessDayCount: number;
    /** Bids that share a day with another bid in the input. */
    sameDayConflictCount: number;
  };
}

/** Number of days between two yyyy-mm-dd strings, signed (to - from). */
function daysBetween(from: CalDate, to: CalDate): number {
  const a = new Date(from + 'T00:00:00Z').getTime();
  const b = new Date(to + 'T00:00:00Z').getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Return the Monday that starts the ISO week containing `date`.
 *  ISO weeks: Mon = day 1, Sun = day 7. UTC-anchored to match the
 *  rest of the date helpers in this codebase. */
function isoMondayOfWeek(date: CalDate): CalDate {
  const d = new Date(date + 'T00:00:00Z');
  const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
  // ISO: shift Sun (0) → 7, then offset back to Monday.
  const isoDow = dow === 0 ? 7 : dow;
  const monday = new Date(d.getTime() - (isoDow - 1) * 86_400_000);
  return monday.toISOString().slice(0, 10);
}

/** Sunday-end of the week for the given Monday. */
function isoSundayOfWeek(monday: CalDate): CalDate {
  const d = new Date(monday + 'T00:00:00Z');
  const sun = new Date(d.getTime() + 6 * 86_400_000);
  return sun.toISOString().slice(0, 10);
}

export interface BuildUpcomingBidCalendarInput {
  bids: UpcomingBidInput[];
  /** ISO yyyy-mm-dd — anchor for "days until due" + "this week". */
  asOfDate: CalDate;
  /** Drop bids whose due date is strictly before asOfDate. Default
   *  true. Set false when caller wants to surface a missed bid. */
  dropPast?: boolean;
}

export function buildUpcomingBidCalendar(
  input: BuildUpcomingBidCalendarInput,
): UpcomingBidCalendar {
  const dropPast = input.dropPast ?? true;

  // Count occurrences of each due-date so we can flag same-day conflicts
  // even if the rows scatter across the input.
  const dueCounts = new Map<CalDate, number>();
  for (const b of input.bids) {
    dueCounts.set(b.bidDueDate, (dueCounts.get(b.bidDueDate) ?? 0) + 1);
  }

  const rows: UpcomingBidRow[] = input.bids
    .map((b) => {
      const daysUntilDue = daysBetween(input.asOfDate, b.bidDueDate);
      return {
        ...b,
        daysUntilDue,
        fallsOnNonBusinessDay: !isBusinessDay(b.bidDueDate),
        sameDayConflict: (dueCounts.get(b.bidDueDate) ?? 0) > 1,
      };
    })
    .filter((r) => (dropPast ? r.daysUntilDue >= 0 : true))
    .sort((a, b) => a.bidDueDate.localeCompare(b.bidDueDate));

  // Bucket by ISO week.
  const weekMap = new Map<CalDate, UpcomingBidWeek>();
  for (const r of rows) {
    const weekStart = isoMondayOfWeek(r.bidDueDate);
    let bucket = weekMap.get(weekStart);
    if (!bucket) {
      bucket = {
        weekStart,
        weekEnd: isoSundayOfWeek(weekStart),
        rows: [],
      };
      weekMap.set(weekStart, bucket);
    }
    bucket.rows.push(r);
  }
  const weeks = [...weekMap.values()].sort((a, b) =>
    a.weekStart.localeCompare(b.weekStart),
  );

  const nextSevenDays = rows.filter(
    (r) => r.daysUntilDue >= 0 && r.daysUntilDue <= 7,
  ).length;
  const nonBusinessDayCount = rows.filter((r) => r.fallsOnNonBusinessDay).length;
  const sameDayConflictCount = rows.filter((r) => r.sameDayConflict).length;

  return {
    rows,
    weeks,
    counts: {
      total: rows.length,
      nextSevenDays,
      nonBusinessDayCount,
      sameDayConflictCount,
    },
  };
}
