'use client';

// Status filter chips for the /estimates list. Pure DOM-style filter
// like the search input — toggles row visibility based on each row's
// data-status attribute. Default 'all' shows everything.

import { useEffect, useState } from 'react';

type FilterValue = 'all' | 'pursuing' | 'submitted' | 'awarded' | 'lost';

interface Props {
  targetId: string;
  /** Counts per status, used to dim chips with zero rows. */
  counts: Record<Exclude<FilterValue, 'all'>, number>;
  total: number;
}

const ORDER: ReadonlyArray<{ value: FilterValue; label: string; tone: string }> = [
  { value: 'all', label: 'All', tone: 'border-gray-300 bg-white text-gray-700' },
  {
    value: 'pursuing',
    label: 'Pursuing',
    tone: 'border-amber-300 bg-amber-50 text-amber-800',
  },
  {
    value: 'submitted',
    label: 'Submitted',
    tone: 'border-blue-300 bg-blue-50 text-blue-800',
  },
  {
    value: 'awarded',
    label: 'Awarded',
    tone: 'border-green-300 bg-green-50 text-green-800',
  },
  {
    value: 'lost',
    label: 'Lost',
    tone: 'border-gray-300 bg-gray-100 text-gray-600',
  },
];

export function EstimatesStatusFilter({ targetId, counts, total }: Props) {
  const [active, setActive] = useState<FilterValue>('all');

  useEffect(() => {
    const table = document.getElementById(targetId);
    if (!table) return;
    const rows = table.querySelectorAll<HTMLTableRowElement>(
      'tbody > tr[data-search]',
    );
    rows.forEach((row) => {
      const status = (row.dataset['status'] ?? 'pursuing') as Exclude<
        FilterValue,
        'all'
      >;
      const visible = active === 'all' || status === active;
      // Cooperate with the search filter — that one writes 'none' too.
      // Use a separate dataset flag so neither stomps the other.
      row.dataset['statusHidden'] = visible ? '' : '1';
      // Recompute the effective display: hidden if either filter says so.
      const searchHidden = row.dataset['searchHidden'] === '1';
      row.style.display = visible && !searchHidden ? '' : 'none';
    });
  }, [active, targetId]);

  return (
    <div className="mb-3 flex flex-wrap gap-1.5 text-xs">
      {ORDER.map((opt) => {
        const isActive = opt.value === active;
        const count =
          opt.value === 'all'
            ? total
            : (counts[opt.value as Exclude<FilterValue, 'all'>] ?? 0);
        const isEmpty = count === 0 && opt.value !== 'all';
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActive(opt.value)}
            className={`rounded-full border px-2 py-0.5 font-medium transition ${
              isActive
                ? `${opt.tone} ring-1 ring-offset-1`
                : `border-gray-200 bg-white text-gray-500 hover:bg-gray-50 ${isEmpty ? 'opacity-40' : ''}`
            }`}
            disabled={isEmpty}
          >
            {opt.label} <span className="opacity-60">({count})</span>
          </button>
        );
      })}
    </div>
  );
}
