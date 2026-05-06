'use client';

// Small client island holding a text-search filter for the
// /estimates list. Parent server component renders the full table;
// this component sits above it and toggles row visibility based on
// each row's data-search attribute. No server round-trip.

import { useEffect, useState } from 'react';

interface Props {
  /** Comma-separated list of table IDs to filter, OR a single table id.
   *  Each row should have a data-search attribute with the searchable text. */
  targetId: string;
  totalCount: number;
}

export function EstimatesSearchInput({ targetId, totalCount }: Props) {
  const [q, setQ] = useState('');
  const [matched, setMatched] = useState<number>(totalCount);

  useEffect(() => {
    const ids = targetId.split(',').map((x) => x.trim()).filter(Boolean);
    const needle = q.trim().toLowerCase();
    let count = 0;
    for (const id of ids) {
      const table = document.getElementById(id);
      if (!table) continue;
      const rows = table.querySelectorAll<HTMLTableRowElement>(
        'tbody > tr[data-search]',
      );
      rows.forEach((row) => {
        const hay = (row.dataset['search'] ?? '').toLowerCase();
        const visible = needle.length === 0 || hay.includes(needle);
        row.style.display = visible ? '' : 'none';
        if (visible) count++;
      });
    }
    setMatched(count);
  }, [q, targetId, totalCount]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter by project or agency…"
        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      />
      {q.trim().length > 0 && (
        <span className="text-xs text-gray-600">
          {matched} of {totalCount} match
        </span>
      )}
    </div>
  );
}
