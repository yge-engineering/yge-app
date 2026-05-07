'use client';

// Triggers a router.refresh() to re-fetch the dashboard's server-
// rendered data without a full reload. Visual cue while refreshing.

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function DashboardRefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        setBusy(true);
        router.refresh();
        // Best-effort: clear busy after a short tick. router.refresh()
        // doesn't return a promise we can await reliably.
        window.setTimeout(() => setBusy(false), 800);
      }}
      disabled={busy}
      className="rounded border border-gray-300 bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-60 print:hidden"
      title="Re-fetch dashboard data"
    >
      {busy ? '⟳ Refreshing…' : '↻ Refresh'}
    </button>
  );
}
