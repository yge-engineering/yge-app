'use client';

// Toggle filter chip — when active, hide rows that aren't pinned.
// Composes with other filters via dataset['pinHidden'].

import { useEffect, useState } from 'react';

interface Props {
  targetId: string;
}

const STORAGE_KEY = 'yge.estimates.pinFilter';
const PIN_KEY = 'yge.estimates.pinnedIds';
const PIN_EVENT = 'yge:pinned-changed';

function readPinned(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(PIN_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

export function EstimatesPinFilterChip({ targetId }: Props) {
  const [active, setActive] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  });
  const [pinnedCount, setPinnedCount] = useState<number>(0);

  useEffect(() => {
    function refresh() {
      setPinnedCount(readPinned().size);
    }
    refresh();
    window.addEventListener(PIN_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(PIN_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(STORAGE_KEY, active ? '1' : '0');
      } catch {}
    }
    const table = document.getElementById(targetId);
    if (!table) return;
    const pinned = readPinned();
    const rows = table.querySelectorAll<HTMLTableRowElement>(
      'tbody > tr[data-search]',
    );
    rows.forEach((row) => {
      const id = row.dataset['id'] ?? '';
      const visible = !active || pinned.has(id);
      row.dataset['pinHidden'] = visible ? '' : '1';
      const search = row.dataset['searchHidden'] === '1';
      const status = row.dataset['statusHidden'] === '1';
      const due = row.dataset['dueHidden'] === '1';
      const created = row.dataset['createdHidden'] === '1';
      const pin = row.dataset['pinHidden'] === '1';
      row.style.display =
        search || status || due || created || pin ? 'none' : '';
    });
  }, [active, targetId, pinnedCount]);

  if (pinnedCount === 0) return null;
  return (
    <button
      type="button"
      onClick={() => setActive((v) => !v)}
      className={`rounded-full border px-2 py-0.5 text-xs font-medium transition ${
        active
          ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700 ring-1 ring-offset-1'
          : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
      }`}
      title="Show only pinned rows"
    >
      📌 Pinned only ({pinnedCount})
    </button>
  );
}
