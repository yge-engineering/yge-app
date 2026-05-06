'use client';

// Clears /jobs persisted filters (created-filter for now). Hidden
// when no filter is active so it doesn't clutter the default view.

import { useEffect, useState } from 'react';

const KEYS = ['yge.jobs.createdFilter'];

export function JobsResetFilters() {
  const [hasState, setHasState] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const v = window.localStorage.getItem('yge.jobs.createdFilter');
    setHasState(Boolean(v && v !== 'all'));
  }, []);

  if (!hasState) return null;

  function reset() {
    if (typeof window === 'undefined') return;
    for (const k of KEYS) {
      try {
        window.localStorage.removeItem(k);
      } catch {
        // non-fatal
      }
    }
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={reset}
      className="rounded border border-gray-300 bg-white px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
      title="Clear persisted filters"
    >
      ✕ Clear filters
    </button>
  );
}
