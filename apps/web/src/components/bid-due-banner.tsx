// Bid-due banner — renders inline across estimate-related pages so the
// estimator can't miss the countdown. Server-component-friendly: pure
// render based on a string in + the current time; no client state.
//
// Visibility rules (from packages/shared/src/bid-due-countdown.ts):
//   - level=none → renders nothing (e.g. job has no due date logged)
//   - level=green → quiet info strip ('Bid due in N days')
//   - level=yellow / orange / red → loud coloured banner

import { bidDueCountdown, type BidDueLevel } from '@yge/shared';
import { getTranslator } from '../lib/locale';
import { coerceLocale } from '@yge/shared';
import { cookies } from 'next/headers';

interface Props {
  bidDueDate: string | undefined | null;
  /** Optional override for testing / fixed-time renders. */
  now?: Date;
  /** When true, render even on the green level. Default false to stay
   *  out of the way until urgency kicks in. */
  showWhenQuiet?: boolean;
}

const LEVEL_STYLES: Record<Exclude<BidDueLevel, 'none'>, string> = {
  green: 'border-green-300 bg-green-50 text-green-800',
  yellow: 'border-yellow-400 bg-yellow-50 text-yellow-800',
  orange: 'border-orange-400 bg-orange-50 text-orange-900',
  red: 'border-red-500 bg-red-50 text-red-900 font-semibold',
};

const LEVEL_KEY: Record<Exclude<BidDueLevel, 'none'>, string> = {
  green: 'bidDueBanner.green',
  yellow: 'bidDueBanner.yellow',
  orange: 'bidDueBanner.orange',
  red: 'bidDueBanner.red',
};

export function BidDueBanner({ bidDueDate, now, showWhenQuiet = false }: Props) {
  const t = getTranslator();
  const localeCookie = cookies().get('yge-locale')?.value;
  const locale = coerceLocale(localeCookie);
  const c = bidDueCountdown(bidDueDate, now, locale);
  if (c.level === 'none') return null;
  if (c.level === 'green' && !showWhenQuiet) return null;

  const styles = LEVEL_STYLES[c.level];
  const title = t(LEVEL_KEY[c.level]);

  return (
    <div
      className={`flex items-center justify-between gap-4 rounded border px-4 py-2 text-sm ${styles}`}
      title={c.longLabel}
    >
      <div className="flex items-center gap-3">
        <span className="text-xs uppercase tracking-wide opacity-70">
          {title}
        </span>
        <span>{c.longLabel}</span>
      </div>
      <span className="text-base font-bold tabular-nums">{c.shortLabel}</span>
    </div>
  );
}
