// California business-day calendar.
//
// Returns the set of state-observed business holidays for a given year
// (Gov. Code §6700 + the federal holidays California honors) and offers
// the business-day math we need across the app:
//
//   - DAS-140 + DAS-142 ("file within 5 business days of award")
//   - Bid-due-date sanity ("the agency's due date is Christmas — confirm")
//   - Payroll cutoff slips ("payday lands on a Saturday — pull forward")
//   - CPR-due deadlines ("within 10 days after the close of each payroll
//     period" — DIR interpretation uses business days)
//
// Pure ISO-string interface (yyyy-mm-dd) so the helper is timezone-safe
// and stays Node + browser identical. CalDates here are Pacific dates —
// the bookkeeping/labor world runs on the contractor's local day, not
// UTC, and that's the convention every other date helper in this repo
// (audit timestamps excepted) uses.

/** ISO 8601 yyyy-mm-dd. */
export type CalDate = string;

export interface CaliforniaHoliday {
  date: CalDate;
  name: string;
  /** federal = US federal observance; state = California-specific add;
   *  yge = YGE's company-specific closure (Christmas Eve, day after
   *  Thanksgiving, summer Friday). The default business-day calendar
   *  treats federal + state as non-business; YGE entries are surfaced
   *  separately so payroll/timecard code can honor them while bid math
   *  (which only respects state-recognized closures) ignores them. */
  kind: 'federal' | 'state' | 'yge';
}

/** Inputs to californiaHolidays(). Mostly useful for opting OUT of YGE
 *  closures when running deadline math against an external clock (the
 *  state doesn't know YGE takes the day after Thanksgiving off). */
export interface HolidayOptions {
  includeYgeClosures?: boolean;
}

const PAD = (n: number) => n.toString().padStart(2, '0');
const iso = (y: number, m: number, d: number) =>
  `${y}-${PAD(m)}-${PAD(d)}`;

/** Fixed-date holidays (same calendar date every year). When the date
 *  lands on a weekend, the observance shifts:
 *    Saturday → Friday before
 *    Sunday   → Monday after
 *  per the federal rule, which California mirrors. */
const FIXED: Array<{ month: number; day: number; name: string }> = [
  { month: 1, day: 1, name: "New Year's Day" },
  // Caesar Chavez Day — CA-specific.
  { month: 3, day: 31, name: 'Cesar Chavez Day' },
  { month: 6, day: 19, name: 'Juneteenth' },
  { month: 7, day: 4, name: 'Independence Day' },
  { month: 11, day: 11, name: 'Veterans Day' },
  { month: 12, day: 25, name: 'Christmas Day' },
];

/** Nth weekday of month — used for MLK Day (3rd Monday of Jan),
 *  Presidents' Day (3rd Mon of Feb), Memorial Day (last Mon of May),
 *  Labor Day (1st Mon of Sept), Columbus Day (2nd Mon of Oct, NOT
 *  observed by CA), Thanksgiving (4th Thu of Nov). */
function nthWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number, // 0=Sun..6=Sat
  n: number,
): CalDate {
  // Find the first occurrence of `weekday` in the month.
  const first = new Date(Date.UTC(year, month - 1, 1));
  const firstWeekday = first.getUTCDay();
  const offset = (weekday - firstWeekday + 7) % 7;
  const day = 1 + offset + (n - 1) * 7;
  return iso(year, month, day);
}

function lastWeekdayOfMonth(
  year: number,
  month: number,
  weekday: number,
): CalDate {
  // Last day of month.
  const last = new Date(Date.UTC(year, month, 0));
  const lastWeekday = last.getUTCDay();
  const offset = (lastWeekday - weekday + 7) % 7;
  return iso(year, month, last.getUTCDate() - offset);
}

/** Shift weekend-falling fixed dates to nearest weekday per the
 *  federal observance rule. */
function observed(date: CalDate): CalDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const weekday = dt.getUTCDay();
  if (weekday === 6) {
    // Saturday → Friday before
    const back = new Date(dt.getTime() - 86_400_000);
    return iso(back.getUTCFullYear(), back.getUTCMonth() + 1, back.getUTCDate());
  }
  if (weekday === 0) {
    // Sunday → Monday after
    const fwd = new Date(dt.getTime() + 86_400_000);
    return iso(fwd.getUTCFullYear(), fwd.getUTCMonth() + 1, fwd.getUTCDate());
  }
  return date;
}

/**
 * Return California's observed business holidays for a single calendar
 * year, sorted by date.
 *
 * Includes US federal holidays California honors + the CA-specific
 * Cesar Chavez Day. Floating holidays (MLK Day, Presidents' Day,
 * Memorial Day, Labor Day, Thanksgiving + day after, etc.) are
 * computed by weekday rule. Fixed-date holidays falling on a weekend
 * shift to the nearest weekday per federal rule.
 *
 * The day after Thanksgiving is treated as a STATE holiday — CA's
 * judicial branch + DIR observe it.
 *
 * Pass `includeYgeClosures: true` to add YGE's company closures
 * (Christmas Eve + the last business week of the year through 1/1).
 */
export function californiaHolidays(
  year: number,
  options: HolidayOptions = {},
): CaliforniaHoliday[] {
  const out: CaliforniaHoliday[] = [];

  // Fixed-date federal / state.
  for (const f of FIXED) {
    const raw = iso(year, f.month, f.day);
    out.push({
      date: observed(raw),
      name: f.name,
      kind: f.name === 'Cesar Chavez Day' ? 'state' : 'federal',
    });
  }

  // Floating federal.
  out.push({
    date: nthWeekdayOfMonth(year, 1, 1, 3),
    name: 'Martin Luther King Jr. Day',
    kind: 'federal',
  });
  out.push({
    date: nthWeekdayOfMonth(year, 2, 1, 3),
    name: "Presidents' Day",
    kind: 'federal',
  });
  out.push({
    date: lastWeekdayOfMonth(year, 5, 1),
    name: 'Memorial Day',
    kind: 'federal',
  });
  out.push({
    date: nthWeekdayOfMonth(year, 9, 1, 1),
    name: 'Labor Day',
    kind: 'federal',
  });
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4);
  out.push({
    date: thanksgiving,
    name: 'Thanksgiving',
    kind: 'federal',
  });
  // Day-after-Thanksgiving — CA state observance.
  out.push({
    date: addDays(thanksgiving, 1),
    name: 'Day after Thanksgiving',
    kind: 'state',
  });

  if (options.includeYgeClosures) {
    // YGE closes 12/24 (Christmas Eve) + the gap between Christmas and
    // New Year. Iterate from 12/24 → 12/31, skip Christmas Day (already
    // in FIXED) and any weekend days. Use 'yge' so deadline math can
    // ignore them when needed.
    for (let d = 24; d <= 31; d += 1) {
      const date = iso(year, 12, d);
      if (date === iso(year, 12, 25)) continue;
      const wd = new Date(Date.UTC(year, 11, d)).getUTCDay();
      if (wd === 0 || wd === 6) continue;
      out.push({
        date,
        name: 'YGE year-end closure',
        kind: 'yge',
      });
    }
  }

  return dedupSort(out);
}

function dedupSort(rows: CaliforniaHoliday[]): CaliforniaHoliday[] {
  // De-dupe by (date, name). Two different rules can land on the same
  // observed date (rare — Cesar Chavez 2024-03-31 was a Sunday → 4/1
  // observed — doesn't collide with anything, but we guard anyway).
  const seen = new Set<string>();
  const out: CaliforniaHoliday[] = [];
  for (const r of rows) {
    const k = `${r.date}:${r.name}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

/** Build a Set<CalDate> for O(1) holiday lookup. Includes YGE
 *  closures iff `includeYgeClosures` is true. */
export function californiaHolidaySet(
  year: number,
  options: HolidayOptions = {},
): Set<CalDate> {
  return new Set(californiaHolidays(year, options).map((h) => h.date));
}

/** True when `date` is a CA business day (not Sat, not Sun, not a
 *  recognized holiday). `includeYgeClosures` defaults false so that
 *  external-deadline math (DAS-140, agency due dates) ignores YGE's
 *  internal closures — those only matter for payroll-side code, which
 *  passes the option in. */
export function isBusinessDay(
  date: CalDate,
  options: HolidayOptions = {},
): boolean {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  const wd = dt.getUTCDay();
  if (wd === 0 || wd === 6) return false;
  const holidays = californiaHolidaySet(y!, options);
  return !holidays.has(date);
}

/** Add an ISO-date offset in days. Pure arithmetic — no timezone
 *  shenanigans. */
export function addDays(date: CalDate, days: number): CalDate {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y!, m! - 1, d!));
  dt.setUTCDate(dt.getUTCDate() + days);
  return iso(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

/** Move forward `count` business days from `date`. If `date` itself
 *  is a business day, that day counts as day 0 — the function returns
 *  the date that is `count` business days AFTER it. Pass 0 to get the
 *  next business day on/after the input (which is `date` itself if
 *  it's a business day, otherwise the next one). */
export function addBusinessDays(
  date: CalDate,
  count: number,
  options: HolidayOptions = {},
): CalDate {
  if (count < 0) {
    throw new Error('addBusinessDays: count must be >= 0');
  }
  let cur = date;
  // Snap to the next business day if start is a weekend / holiday.
  while (!isBusinessDay(cur, options)) cur = addDays(cur, 1);
  let remaining = count;
  while (remaining > 0) {
    cur = addDays(cur, 1);
    if (isBusinessDay(cur, options)) remaining -= 1;
  }
  return cur;
}

/** Mirror of addBusinessDays moving in the OTHER direction. Returns the
 *  date that is `count` business days BEFORE `date`. Used by 72-hour-
 *  notice math (DAS-142) and similar "no later than" deadlines. If the
 *  start date is itself a weekend / holiday, snaps backward to the
 *  previous business day before counting. */
export function subtractBusinessDays(
  date: CalDate,
  count: number,
  options: HolidayOptions = {},
): CalDate {
  if (count < 0) {
    throw new Error('subtractBusinessDays: count must be >= 0');
  }
  let cur = date;
  while (!isBusinessDay(cur, options)) cur = addDays(cur, -1);
  let remaining = count;
  while (remaining > 0) {
    cur = addDays(cur, -1);
    if (isBusinessDay(cur, options)) remaining -= 1;
  }
  return cur;
}

/** Convenience: the next CA business day on or after `date`. */
export function nextBusinessDay(
  date: CalDate,
  options: HolidayOptions = {},
): CalDate {
  let cur = date;
  while (!isBusinessDay(cur, options)) cur = addDays(cur, 1);
  return cur;
}

/** Count of CA business days in the half-open interval [from, to)
 *  (i.e., excludes `to`). Useful for "how many work days slipped"
 *  math. Both endpoints must be valid ISO yyyy-mm-dd strings; throws
 *  if `from` > `to`. */
export function businessDaysBetween(
  from: CalDate,
  to: CalDate,
  options: HolidayOptions = {},
): number {
  if (from > to) {
    throw new Error('businessDaysBetween: from must be <= to');
  }
  let count = 0;
  let cur = from;
  while (cur < to) {
    if (isBusinessDay(cur, options)) count += 1;
    cur = addDays(cur, 1);
  }
  return count;
}
