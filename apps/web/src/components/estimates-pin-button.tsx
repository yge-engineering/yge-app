'use client';

// Pin/unpin a single estimate id. Stored in localStorage as a JSON
// array. On change, dispatches a window event so the parent reorder
// effect can pick it up.

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yge.estimates.pinnedIds';
const EVENT = 'yge:pinned-changed';

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

export function EstimatesPinButton({ estimateId }: { estimateId: string }) {
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    function refresh() {
      setPinned(readPinned().has(estimateId));
    }
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [estimateId]);

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const set = readPinned();
        if (set.has(estimateId)) set.delete(estimateId);
        else set.add(estimateId);
        writePinned(set);
        setPinned(set.has(estimateId));
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

/** Reorder client island — moves rows whose data-id is pinned to
 *  the top of the tbody. Re-runs on EVENT or window load. */
export function EstimatesPinReorder({ targetId }: { targetId: string }) {
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
      // Stable: pinned rows in their existing order go first; rest stay put.
      const pinnedRows = rows.filter((r) => pinned.has(r.dataset['id'] ?? ''));
      const restRows = rows.filter((r) => !pinned.has(r.dataset['id'] ?? ''));
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
