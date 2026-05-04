// DateAgo — relative timestamp ('5 min ago', '3 days ago', '2 weeks
// ago', then absolute date for older).
//
// Plain English: drop in `<DateAgo iso={someTimestamp} />` and get a
// human-readable relative time. Handles missing / blank / malformed
// inputs by rendering '—'. Server-rendered (no 'use client') so it
// works in server components. The relative time will be calculated
// from the SERVER's clock — close enough for our use case.

import { getTranslator, type Translator } from '../lib/locale';

interface Props {
  /** ISO datetime string, or yyyy-mm-dd date string. */
  iso?: string | null;
  /** Tooltip on hover — exact ISO timestamp. Default true. */
  showTooltip?: boolean;
}

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

export function DateAgo({ iso, showTooltip = true }: Props) {
  if (!iso) return <span className="text-gray-400">—</span>;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return <span className="text-gray-400">{iso}</span>;
  const ms = Date.now() - t;
  const tr = getTranslator();
  const text = formatRelative(ms, iso, tr);
  return (
    <time
      dateTime={iso}
      title={showTooltip ? new Date(iso).toLocaleString() : undefined}
      className="whitespace-nowrap text-gray-600"
    >
      {text}
    </time>
  );
}

function formatRelative(ms: number, iso: string, t: Translator): string {
  if (ms < MIN) return t('dateAgo.justNow');
  if (ms < HOUR) {
    const m = Math.round(ms / MIN);
    return m === 1 ? t('dateAgo.minOne') : t('dateAgo.minMany', { n: m });
  }
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return h === 1 ? t('dateAgo.hrOne') : t('dateAgo.hrMany', { n: h });
  }
  if (ms < WEEK) {
    const d = Math.round(ms / DAY);
    return d === 1 ? t('dateAgo.dayOne') : t('dateAgo.dayMany', { n: d });
  }
  // Older — use absolute date.
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
