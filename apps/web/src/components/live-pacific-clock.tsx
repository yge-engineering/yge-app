'use client';

// Live Pacific-timezone clock for the dashboard header. Replaces
// the server-rendered "As of N:NN" stamp which had two bugs:
//   1. No timeZone in toLocaleTimeString → rendered in whatever TZ
//      the Render container ran in (UTC), not Pacific.
//   2. Captured at server-render time and never updated — could sit
//      stale for hours if Ryan left the tab open.
//
// This component takes an initial ISO string for the first paint
// (server-rendered, so the "As of" doesn't flash empty), then ticks
// in the browser every 30 seconds. Always formats in
// America/Los_Angeles, matching the date string above it.

import { useEffect, useState } from 'react';

interface Props {
  /** ISO string captured at server render. First paint only. */
  initialIso: string;
}

const FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  minute: '2-digit',
});

const TOOLTIP_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
});

export function LivePacificClock({ initialIso }: Props) {
  const [now, setNow] = useState<Date>(() => new Date(initialIso));

  useEffect(() => {
    // Tick every 30s. A minute would also work but 30s keeps the
    // "As of" feeling current right at the top of each minute when
    // someone glances over.
    const handle = window.setInterval(() => {
      setNow(new Date());
    }, 30_000);
    // Snap to actual time on mount in case the server-render time
    // was slow to arrive.
    setNow(new Date());
    return () => window.clearInterval(handle);
  }, []);

  return (
    <span className="text-[10px] text-gray-500" title={TOOLTIP_FORMATTER.format(now)}>
      As of {FORMATTER.format(now)} Pacific
    </span>
  );
}
