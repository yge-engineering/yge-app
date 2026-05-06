'use client';

// Created-date filter chips for /jobs list. Same pattern as the
// estimates-created-filter (1040). Composes with the search input.

import { useEffect, useState } from 'react';

type Preset = 'all' | 'week' | 'month' | 'quarter';
const STORAGE_KEY = 'yge.jobs.createdFilter';

const ORDER: ReadonlyArray<{ value: Preset; label: string; days: number | null }> = [
  { value: 'all', label: 'All time', days: null },
  { value: 'quarter', label: '90 days', days: 90 },
  { value: 'month', label: 'This month', days: 30 },
  { value: 'week', label: 'This week', days: 7 },
];

interface Props {
  targetId: string;
}

export function JobsCreatedFilter({ targetId }: Props) {
  const [active, setActive] = useState<Preset>(() => {
    if (typeof window === 'undefined') return 'all';
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'week' || v === 'month' || v === 'quarter' || v === 'all') return v;
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
    const table = document.getElementById(targetId);
    if (!table) return;
    const preset = ORDER.find((p) => p.value === active);
    const cutoff =
      preset?.days != null ? Date.now() - preset.days * 24 * 60 * 60 * 1000 : null;
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
      // Search filter writes display:none directly (jobs page has no
      // visibility-flag chain), so wrap our decision around it.
      const stillMatchesSearch = row.style.display !== 'none' || visible;
      // Use our own data-attribute to track the created filter outcome.
      row.dataset['createdHidden'] = visible ? '' : '1';
      // The jobs search input uses display directly. To compose with
      // it, only set display:none here; if we'd hide and search has
      // already hidden, that's a no-op. If we'd show and search hides,
      // search wins. Effect re-runs on every keystroke anyway.
      if (!visible) row.style.display = 'none';
      else if (stillMatchesSearch) row.style.display = '';
    });
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
