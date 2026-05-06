'use client';

// Tiny client island that clears the persisted filter state and
// reloads the page. Reads localStorage to decide whether anything
// is currently filtered (so we hide the link when defaults are
// already in effect).

import { useEffect, useState } from 'react';

const KEYS = [
  'yge.estimates.statusFilter',
  'yge.estimates.dueWeekFilter',
  'yge.estimates.sortKey',
  'yge.estimates.sortDir',
  'yge.estimates.createdFilter',
];

export function EstimatesResetFilters() {
  const [hasState, setHasState] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const status = window.localStorage.getItem('yge.estimates.statusFilter');
    const due = window.localStorage.getItem('yge.estimates.dueWeekFilter');
    const sortKey = window.localStorage.getItem('yge.estimates.sortKey');
    const created = window.localStorage.getItem('yge.estimates.createdFilter');
    const any =
      (status && status !== 'all') ||
      due === '1' ||
      (sortKey && sortKey.length > 0) ||
      (created && created !== 'all');
    setHasState(Boolean(any));
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
      title="Clear status / due / sort filters"
    >
      ✕ Clear filters
    </button>
  );
}
