'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yge.drafts.pinnedIds';
const EVENT = 'yge:drafts-pinned-changed';

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
  } catch {}
  window.dispatchEvent(new Event(EVENT));
}

export function DraftsPinButton({ draftId }: { draftId: string }) {
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    function refresh() {
      setPinned(readPinned().has(draftId));
    }
    refresh();
    window.addEventListener(EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [draftId]);

  return (
    <button
      type="button"
      onClick={(ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        const set = readPinned();
        if (set.has(draftId)) set.delete(draftId);
        else set.add(draftId);
        writePinned(set);
        setPinned(set.has(draftId));
      }}
      className={`mr-1 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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

export function DraftsPinReorder({ targetId }: { targetId: string }) {
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
      [...pinnedRows, ...restRows].forEach((r) => tbody.appendChild(r));
    }
    reorder();
    window.addEventListener(EVENT, reorder);
    const tableEl = document.getElementById(targetId);
    const tbodyEl = tableEl?.querySelector('tbody');
    let mo: MutationObserver | null = null;
    if (tbodyEl) {
      mo = new MutationObserver(() => {
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
