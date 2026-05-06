'use client';

import { useEffect, useState } from 'react';

interface Props {
  targetId: string;
}

const STORAGE_KEY = 'yge.jobs.pinFilter';
const PIN_KEY = 'yge.jobs.pinnedIds';
const PIN_EVENT = 'yge:jobs-pinned-changed';

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

export function JobsPinFilterChip({ targetId }: Props) {
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
      // /jobs page doesn't have the visibility-flag chain — set display directly.
      row.style.display = visible ? '' : 'none';
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
      title="Show only pinned jobs"
    >
      📌 Pinned only ({pinnedCount})
    </button>
  );
}
