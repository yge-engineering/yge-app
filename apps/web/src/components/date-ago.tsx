// DateAgo — relative timestamp ('5 min ago', '3 days ago', '2 weeks
// ago', then absolute date for older).
//
// Plain English: drop in `<DateAgo iso={someTimestamp} />` and get a
// human-readable relative time. Handles missing / blank / malformed
// inputs by rendering '—'. Server-rendered (no 'use client') so it
// works in server components. The relative time will be calculated
// from the SERVER's clock — close enough for our use case.

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
  const text = formatRelative(ms, iso);
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

function formatRelative(ms: number, iso: string): string {
  if (ms < MIN) return 'just now';
  if (ms < HOUR) {
    const m = Math.round(ms / MIN);
    return `${m} min${m === 1 ? '' : 's'} ago`;
  }
  if (ms < DAY) {
    const h = Math.round(ms / HOUR);
    return `${h} hr${h === 1 ? '' : 's'} ago`;
  }
  if (ms < WEEK) {
    const d = Math.round(ms / DAY);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  // Older — use absolute date.
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
