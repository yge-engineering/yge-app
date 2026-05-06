'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yge.jobs.pinnedIds';
const EVENT = 'yge:jobs-pinned-changed';

function readPinned(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x): x is string => typeof x === 'string'));
  } catch {
    return new Set();
  }
}

function writePinned(set: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // non-fatal
  }
  window.dispatchEvent(new Event(EVENT));
}

export function JobsPinButton({ jobId }: { jobId: string }) {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    function refresh() {
      setPinned(readPinned().has(jobId));
    }
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [jobId]);

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const set = readPinned();
        if (set.has(jobId)) set.delete(jobId);
        else set.add(jobId);
        writePinned(set);
        setPinned(set.has(jobId));
      }}
      className={`mt-1 mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        pinned
          ? 'border-yge-blue-500 bg-yge-blue-50 text-yge-blue-700'
          : 'border-gray-200 bg-white text-gray-400 hover:border-gray-300 hover:text-gray-600'
      }`}
      title={pinned ? 'Unpin from top' : 'Pin to top of list'}
    >
      {pinned ? '📌 Pinned' : '📌'}
    </button>
  );
}

export function JobsPinReorder({ targetId }: { targetId: string }) {
  useEffect(() => {
    function reorder() {
      const table = document.getElementById(targetId);
      if (!table) return;
      const tbody = table.querySelector('tbody');
      if (!tbody) return;
      const pinned = readPinned();
      const rows = Array.from(
        tbody.querySelectorAll<HTMLTableRowElement>('tr[data-id][data-search]'),
      );
      const pinnedRows = rows.filter((r) => pinned.has(r.dataset['id'] ?? ''));
      const restRows = rows.filter((r) => !pinned.has(r.dataset['id'] ?? ''));
      pinnedRows.forEach((r) => r.classList.add('bg-yge-blue-50/50'));
      restRows.forEach((r) => r.classList.remove('bg-yge-blue-50/50'));
      [...pinnedRows, ...restRows].forEach((r) => tbody.appendChild(r));
    }
    reorder();
    window.addEventListener(EVENT, reorder);
    // Also re-run when the tbody children change (e.g. after a sort
    // header click reorders the rows). MutationObserver catches that
    // without polling. Only watch direct children, not subtree.
    const tableEl = document.getElementById(targetId);
    const tbodyEl = tableEl?.querySelector('tbody');
    let mo: MutationObserver | null = null;
    if (tbodyEl) {
      mo = new MutationObserver(() => {
        // Avoid infinite loops — only re-run if pinned rows aren't already at top.
        const tbody = tableEl?.querySelector('tbody');
        if (!tbody) return;
        const pinned = readPinned();
        if (pinned.size === 0) return;
        const firstRow = tbody.querySelector<HTMLTableRowElement>('tr[data-id]');
        if (firstRow && pinned.has(firstRow.dataset['id'] ?? '')) return;
        reorder();
      });
      mo.observe(tbodyEl, { childList: true });
    }
    return () => {
      window.removeEventListener(EVENT, reorder);
      mo?.disconnect();
    };
  }, [targetId]);
  return null;
}
