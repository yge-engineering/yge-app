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
  const [matchedCents, setMatchedCents] = useState<number>(0);

  useEffect(() => {
    const ids = targetId.split(',').map((x) => x.trim()).filter(Boolean);
    const needle = q.trim().toLowerCase();
    let count = 0;
    let cents = 0;
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
        if (visible) {
          count++;
          const c = Number(row.dataset['cents'] ?? '0');
          if (Number.isFinite(c)) cents += c;
        }
      });
    }
    setMatched(count);
    setMatchedCents(cents);
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
      <span className="text-xs text-gray-600">
        {q.trim().length > 0 ? (
          <>
            {matched} of {totalCount} · subtotal{' '}
          </>
        ) : (
          <>Total · </>
        )}
        <span className="font-mono font-semibold text-gray-900">
          {(matchedCents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })}
        </span>
      </span>
    </div>
  );
}
