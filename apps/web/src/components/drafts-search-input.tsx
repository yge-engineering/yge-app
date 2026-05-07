'use client';

// Client-side search filter for /drafts. Toggles row visibility
// based on data-search. '/' focuses, Esc clears.

import { useEffect, useRef, useState } from 'react';

interface Props {
  targetId: string;
  totalCount: number;
}

export function DraftsSearchInput({ targetId, totalCount }: Props) {
  const [q, setQ] = useState('');
  const [matched, setMatched] = useState(totalCount);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          (t as HTMLElement).isContentEditable)
      ) {
        return;
      }
      e.preventDefault();
      inputRef.current?.focus();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const table = document.getElementById(targetId);
    if (!table) return;
    const needle = q.trim().toLowerCase();
    const rows = table.querySelectorAll<HTMLTableRowElement>(
      'tbody > tr[data-search]',
    );
    let count = 0;
    rows.forEach((row) => {
      const hay = (row.dataset['search'] ?? '').toLowerCase();
      const visible = needle.length === 0 || hay.includes(needle);
      row.style.display = visible ? '' : 'none';
      if (visible) count++;
    });
    setMatched(count);
  }, [q, targetId, totalCount]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            setQ('');
            e.currentTarget.blur();
          }
        }}
        placeholder="Filter by project / agency… (press /)"
        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      />
      {q.trim().length > 0 && (
        <span className="text-xs text-gray-600">
          {matched} of {totalCount} match
        </span>
      )}
    </div>
  );
}
