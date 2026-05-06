'use client';

// Bid-day countdown banner.
//
// Plain English: when an estimate has a bidDueDate set, render a
// sticky banner at the top of the editor that counts down. Within
// 24 hours of the deadline the banner turns red — useful for the
// "should I be panicking?" check at 2:55pm before a 3:00pm bid
// open.
//
// Pure client-side render. We just compare bidDueDate to now and
// re-tick every minute.

import { useEffect, useState } from 'react';

interface Props {
  /** ISO date string or yyyy-mm-dd. Empty / undefined = banner is
   *  hidden. */
  bidDueDate: string | undefined;
}

function diffParts(deadlineMs: number, nowMs: number) {
  const totalMs = deadlineMs - nowMs;
  if (totalMs <= 0) return null;
  const minutes = Math.floor(totalMs / 60_000);
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  return { totalMs, days, hours, mins };
}

function parseDeadline(s: string): number | null {
  // Accept yyyy-mm-dd (assume 2pm Pacific bid open) and full ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // 14:00 Pacific is the most common CA agency bid-open hour.
    // We want a date object that lands at 14:00 PT regardless of
    // the local timezone the browser is in — easiest path is the
    // PT offset for that date. Approximation good enough for the
    // countdown UX: assume PT = UTC-7 in summer / UTC-8 in winter,
    // pick UTC-8 as the conservative default (later deadline) so
    // the countdown doesn't surprise-finish early.
    return Date.parse(`${s}T14:00:00-08:00`);
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

export function BidDueCountdown({ bidDueDate }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const handle = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);

  if (!bidDueDate) return null;
  const deadline = parseDeadline(bidDueDate);
  if (deadline == null) return null;

  const parts = diffParts(deadline, now);
  if (!parts) {
    return (
      <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        Bid open passed ({bidDueDate}).
      </div>
    );
  }

  const within24h = parts.totalMs < 24 * 60 * 60 * 1000;
  const within2h = parts.totalMs < 2 * 60 * 60 * 1000;
  const styles = within2h
    ? 'border-red-500 bg-red-50 text-red-900'
    : within24h
      ? 'border-amber-400 bg-amber-50 text-amber-900'
      : 'border-yge-blue-300 bg-yge-blue-50 text-yge-blue-900';
  const label =
    parts.days > 0
      ? `${parts.days}d ${parts.hours}h`
      : parts.hours > 0
        ? `${parts.hours}h ${parts.mins}m`
        : `${parts.mins}m`;

  return (
    <div className={`rounded-md border px-3 py-2 ${styles}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
        <span className="font-mono text-base font-semibold">⏰ Due in {label}</span>
        <span className="opacity-80">Bid open: {bidDueDate}</span>
      </div>
    </div>
  );
}
