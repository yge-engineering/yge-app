'use client';

// Created-date filter for /estimates list. Reads each row's
// data-created (ISO) and toggles dataset['createdHidden']. Composes
// with the other filters via shared visibility flags.

import { useEffect, useState } from 'react';

type Preset = 'all' | 'week' | 'month';
const STORAGE_KEY = 'yge.estimates.createdFilter';

const ORDER: ReadonlyArray<{ value: Preset; label: string; days: number | null }> = [
  { value: 'all', label: 'All time', days: null },
  { value: 'month', label: 'This month', days: 30 },
  { value: 'week', label: 'This week', days: 7 },
];

interface Props {
  targetId: string;
}

export function EstimatesCreatedFilter({ targetId }: Props) {
  const [active, setActive] = useState<Preset>(() => {
    if (typeof window === 'undefined') return 'all';
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'week' || v === 'month' || v === 'all') return v;
    return 'all';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, active);
      } catch {
        // non-fatal
      }
    }
    const ids = targetId.split(',').map((x) => x.trim()).filter(Boolean);
    const preset = ORDER.find((p) => p.value === active);
    const cutoff =
      preset?.days != null ? Date.now() - preset.days * 24 * 60 * 60 * 1000 : null;
    for (const id of ids) {
      const table = document.getElementById(id);
      if (!table) continue;
      const rows = table.querySelectorAll<HTMLTableRowElement>(
        'tbody > tr[data-search]',
      );
      rows.forEach((row) => {
        let visible = true;
        if (cutoff != null) {
          const iso = row.dataset['created'];
          if (!iso) visible = false;
          else {
            const t = new Date(iso).getTime();
            visible = !Number.isNaN(t) && t >= cutoff;
          }
        }
        row.dataset['createdHidden'] = visible ? '' : '1';
        const search = row.dataset['searchHidden'] === '1';
        const status = row.dataset['statusHidden'] === '1';
        const due = row.dataset['dueHidden'] === '1';
        const created = row.dataset['createdHidden'] === '1';
        row.style.display =
          search || status || due || created ? 'none' : '';
      });
    }
  }, [active, targetId]);

  return (
    <div className="flex items-center gap-1">
      {ORDER.map((opt) => {
        const isActive = opt.value === active;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setActive(opt.value)}
            className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
              isActive
                ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700 ring-1 ring-offset-1'
                : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
