import { translate, SEED_DICTIONARY, type Locale } from './i18n';

// Bid-due countdown — how urgent is this estimate?
//
// Estimates carry an optional `bidDueDate` field that's free-form text in
// Phase 1 ("April 30, 2026 2:00 PM"). The estimator types whatever the
// agency printed on the RFP. This module attempts a best-effort parse and
// returns a UI-ready urgency level so we can light up countdown banners
// across the app without each render site reinventing the date math.
//
// Design rules:
//   - Returns level: 'none' when there's no usable date — render nothing.
//   - Never throws on a malformed date. Just returns 'none'.
//   - Levels escalate: 'green' (>7 days) → 'yellow' (≤7 days) → 'orange'
//     (≤24 hr) → 'red' (≤4 hr or past due). The estimator's eye is drawn
//     to the loud colours; the banner doubles as a "stop adding scope, go
//     finish the bid" reminder.

export type BidDueLevel = 'none' | 'green' | 'yellow' | 'orange' | 'red';

export interface BidDueCountdown {
  /** Urgency band — see module docstring. */
  level: BidDueLevel;
  /** Whole-millisecond delta from now to due. Negative when overdue. */
  deltaMs: number;
  /** Pretty short string for banner ("3d 4h", "47m", "OVERDUE"). */
  shortLabel: string;
  /** Pretty long string for tooltip ("Bid due in 3 days, 4 hours"). */
  longLabel: string;
  /** Whether the parsed date string was ambiguous — UI may want to nudge
   *  the estimator to add a time component to the bid due field. */
  parsedFromTextOnly: boolean;
}

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Best-effort parse of the free-form bidDueDate field. Returns null if the
 *  string can't be coerced to a Date. */
function tryParseDueDate(raw: string): { at: Date; textOnly: boolean } | null {
  const s = raw.trim();
  if (s.length === 0) return null;
  // Direct Date.parse covers ISO and most en-US long forms ("April 30, 2026
  // 2:00 PM"). If it's date-only ("April 30, 2026") it parses to midnight
  // local time — flag textOnly so the UI can nudge for a real time.
  const ms = Date.parse(s);
  if (!Number.isFinite(ms)) return null;
  // textOnly heuristic: no digit-colon-digit (no "h:mm" anywhere).
  const textOnly = !/\d:\d/.test(s);
  return { at: new Date(ms), textOnly };
}

export function bidDueCountdown(
  bidDueDate: string | undefined | null,
  now: Date = new Date(),
  locale: Locale = 'en',
): BidDueCountdown {
  const tr = (key: string, vars?: Record<string, string | number>): string =>
    translate(SEED_DICTIONARY, locale, key, vars);
  const empty: BidDueCountdown = {
    level: 'none',
    deltaMs: 0,
    shortLabel: '',
    longLabel: '',
    parsedFromTextOnly: false,
  };
  if (!bidDueDate) return empty;
  const parsed = tryParseDueDate(bidDueDate);
  if (!parsed) return empty;

  const deltaMs = parsed.at.getTime() - now.getTime();

  if (deltaMs <= 0) {
    return {
      level: 'red',
      deltaMs,
      shortLabel: tr('bidDue.overdueShort'),
      longLabel: tr('bidDue.overdueLong'),
      parsedFromTextOnly: parsed.textOnly,
    };
  }

  let level: BidDueLevel;
  if (deltaMs <= 4 * HOUR_MS) level = 'red';
  else if (deltaMs <= DAY_MS) level = 'orange';
  else if (deltaMs <= 7 * DAY_MS) level = 'yellow';
  else level = 'green';

  return {
    level,
    deltaMs,
    shortLabel: formatShort(deltaMs, tr),
    longLabel: formatLong(deltaMs, tr),
    parsedFromTextOnly: parsed.textOnly,
  };
}

type Tr = (key: string, vars?: Record<string, string | number>) => string;

function formatShort(deltaMs: number, tr: Tr): string {
  const days = Math.floor(deltaMs / DAY_MS);
  const hours = Math.floor((deltaMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((deltaMs % HOUR_MS) / (60 * 1000));
  if (days >= 1) return tr('bidDue.shortDayHr', { days, hours });
  if (hours >= 1) return tr('bidDue.shortHrMin', { hours, minutes });
  return tr('bidDue.shortMin', { minutes });
}

function formatLong(deltaMs: number, tr: Tr): string {
  const days = Math.floor(deltaMs / DAY_MS);
  const hours = Math.floor((deltaMs % DAY_MS) / HOUR_MS);
  const minutes = Math.floor((deltaMs % HOUR_MS) / (60 * 1000));
  const parts: string[] = [];
  if (days >= 1) {
    parts.push(days === 1 ? tr('bidDue.dayOne', { n: days }) : tr('bidDue.dayMany', { n: days }));
  }
  if (hours >= 1) {
    parts.push(hours === 1 ? tr('bidDue.hrOne', { n: hours }) : tr('bidDue.hrMany', { n: hours }));
  }
  if (parts.length === 0) {
    parts.push(minutes === 1 ? tr('bidDue.minOne', { n: minutes }) : tr('bidDue.minMany', { n: minutes }));
  }
  return tr('bidDue.longPrefix', { parts: parts.join(', ') });
}
