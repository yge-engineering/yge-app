// YGE-specific time helpers.
//
// Plain English: the app is run from Cottonwood, CA (Pacific Time).
// Server components on Vercel run in UTC, which means
// `new Date().getHours()` and `new Date().toISOString().slice(0, 10)`
// give us UTC values — wrong for display purposes during evening
// hours when UTC has already rolled to the next day. These helpers
// always return PT-equivalent values regardless of where the server
// is.
//
// Storage / wire-level timestamps stay UTC (CLAUDE.md mandates ISO
// on the wire). These are display helpers only.

const YGE_TIMEZONE = 'America/Los_Angeles';

/** Today's date in YGE's local timezone, as yyyy-mm-dd. */
export function ygeToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: YGE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Hour-of-day (0-23) in YGE's local timezone. */
export function ygeHour(): number {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: YGE_TIMEZONE,
      hour: 'numeric',
      hour12: false,
    }).format(new Date()),
  );
}

/** Format a Date or ISO string in YGE's timezone with the given options.
 *  Mirrors `Intl.DateTimeFormat` API but pre-applies the YGE timezone. */
export function ygeFormatDate(
  d: Date | string,
  options: Intl.DateTimeFormatOptions = {},
): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('en-US', {
    timeZone: YGE_TIMEZONE,
    ...options,
  }).format(date);
}

export { YGE_TIMEZONE };
