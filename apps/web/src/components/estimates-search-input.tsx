'use client';

// Small client island holding a text-search filter for the
// /estimates list. Parent server component renders the full table;
// this component sits above it and toggles row visibility based on
// each row's data-search attribute. No server round-trip.

import { useEffect, useRef, useState } from 'react';

interface Props {
  /** Comma-separated list of table IDs to filter, OR a single table id.
   *  Each row should have a data-search attribute with the searchable text. */
  targetId: string;
  totalCount: number;
}

export function EstimatesSearchInput({ targetId, totalCount }: Props) {
  const [q, setQ] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // '/' focuses the search box when no other input is focused — same
  // shortcut GitHub uses for repo search. Skipped if Cmd/Ctrl/Alt
  // are held so we don't fight existing browser shortcuts.
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

  const [matched, setMatched] = useState<number>(totalCount);
  const [matchedCents, setMatchedCents] = useState<number>(0);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  // Load recent searches on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('yge.estimates.recentSearches');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) {
          setRecentSearches(arr.filter((x): x is string => typeof x === 'string').slice(0, 3));
        }
      }
    } catch {}
  }, []);

  // Save current query to recent searches when it has 3+ chars and stops changing for 1s.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 3) return;
    const handle = window.setTimeout(() => {
      try {
        const raw = window.localStorage.getItem('yge.estimates.recentSearches');
        const existing = raw ? (JSON.parse(raw) as unknown) : [];
        const list = Array.isArray(existing)
          ? existing.filter((x): x is string => typeof x === 'string')
          : [];
        const next = [trimmed, ...list.filter((x) => x !== trimmed)].slice(0, 5);
        window.localStorage.setItem('yge.estimates.recentSearches', JSON.stringify(next));
        setRecentSearches(next.slice(0, 3));
      } catch {}
    }, 1000);
    return () => window.clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    const ids = targetId.split(',').map((x) => x.trim()).filter(Boolean);
    const needle = q.trim().toLowerCase();
    let count = 0;
    let cents = 0;
    for (const id of ids) {
      const table = document.getElementById(id);
      if (!table) continue;
      const rows = table.querySelectorAll<HTMLTableRowElement>(
        'tbody > tr[data-search]',
      );
      rows.forEach((row) => {
        const hay = (row.dataset['search'] ?? '').toLowerCase();
        const matches = needle.length === 0 || hay.includes(needle);
        row.dataset['searchHidden'] = matches ? '' : '1';
        const statusHidden = row.dataset['statusHidden'] === '1';
        const dueHidden = row.dataset['dueHidden'] === '1';
        const createdHidden = row.dataset['createdHidden'] === '1';
        const visible = matches && !statusHidden && !dueHidden && !createdHidden;
        row.style.display = visible ? '' : 'none';
        if (visible) {
          count++;
          const c = Number(row.dataset['cents'] ?? '0');
          if (Number.isFinite(c)) cents += c;
        }
      });
    }
    setMatched(count);
    setMatchedCents(cents);

    // Show / hide a per-table empty-state row added once on mount.
    for (const id of ids) {
      const table = document.getElementById(id);
      if (!table) continue;
      const tbody = table.querySelector('tbody');
      if (!tbody) continue;
      let empty = tbody.querySelector('tr[data-empty-state="1"]') as HTMLTableRowElement | null;
      if (!empty) {
        empty = document.createElement('tr');
        empty.dataset['emptyState'] = '1';
        const td = document.createElement('td');
        td.colSpan = 12; // safe overshoot; CSS hides extra cols
        td.className = 'px-4 py-6 text-center text-sm text-gray-500';
        td.textContent = 'No matches. Adjust the filters above.';
        empty.appendChild(td);
        tbody.appendChild(empty);
      }
      const allHidden = Array.from(
        tbody.querySelectorAll<HTMLTableRowElement>('tr[data-search]'),
      ).every((row) => row.style.display === 'none');
      empty.style.display = allHidden ? '' : 'none';
    }
  }, [q, targetId, totalCount]);

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 text-sm print:hidden">
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
        placeholder="Filter by project or agency… (press / · Esc to clear)"
        className="w-full max-w-xs rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-yge-blue-500 focus:outline-none focus:ring-1 focus:ring-yge-blue-500"
      />
      <span className="text-xs text-gray-600">
        {recentSearches.length > 0 && q.trim().length === 0 && (
        <span className="flex items-center gap-1 text-xs">
          <span className="text-gray-500">Recent:</span>
          {recentSearches.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setQ(r)}
              className="rounded border border-gray-300 bg-white px-2 py-0.5 hover:bg-gray-50"
            >
              {r}
            </button>
          ))}
        </span>
      )}
      {q.trim().length > 0 ? (
          <>
            {matched} of {totalCount} · subtotal{' '}
          </>
        ) : (
          <>Total · </>
        )}
        <span className="font-mono font-semibold text-gray-900">
          {(matchedCents / 100).toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
            maximumFractionDigits: 0,
          })}
        </span>
      </span>
    </div>
  );
}
