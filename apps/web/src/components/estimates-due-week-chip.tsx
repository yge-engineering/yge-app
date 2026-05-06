'use client';

// Toggle chip that filters /estimates to bids due in ≤7 days
// (including overdue). Reads each row's data-due ISO and toggles
// dataset['dueHidden']. The shared visibility code in the search
// filter already AND-combines that with the other hidden flags.

import { useEffect, useState } from 'react';

interface Props {
  targetId: string;
  count: number;
}

const DUE_KEY = 'yge.estimates.dueWeekFilter';

export function EstimatesDueWeekChip({ targetId, count }: Props) {
  const [active, setActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(DUE_KEY) === '1';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DUE_KEY, active ? '1' : '0');
      } catch {
        // non-fatal
      }
    }
    const ids = targetId.split(',').map((x) => x.trim()).filter(Boolean);
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    for (const id of ids) {
      const table = document.getElementById(id);
      if (!table) continue;
      const rows = table.querySelectorAll<HTMLTableRowElement>(
        'tbody > tr[data-search]',
      );
      rows.forEach((row) => {
        let visible = true;
        if (active) {
          const iso = row.dataset['due'];
          if (!iso) visible = false;
          else {
            const t = new Date(iso).getTime();
            visible = !Number.isNaN(t) && t - now <= sevenDays;
          }
        }
        row.dataset['dueHidden'] = visible ? '' : '1';
        const searchHidden = row.dataset['searchHidden'] === '1';
        const statusHidden = row.dataset['statusHidden'] === '1';
        const dueHidden = row.dataset['dueHidden'] === '1';
        row.style.display =
          searchHidden || statusHidden || dueHidden ? 'none' : '';
      });
    }
  }, [active, targetId]);

  return (
    <button
      type="button"
      onClick={() => setActive((v) => !v)}
      className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
        active
          ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700 ring-1 ring-offset-1'
          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
      }`}
      title="Show only bids due in the next 7 days"
    >
      Due ≤ 7d <span className="opacity-60">({count})</span>
    </button>
  );
}
