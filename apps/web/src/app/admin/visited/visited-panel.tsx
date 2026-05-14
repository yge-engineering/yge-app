'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yge-app-visited';

export function VisitedPanel() {
  const [items, setItems] = useState<Array<{ href: string; visitedAt: string }> | null>(null);
  const [href, setHref] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setItems(raw ? JSON.parse(raw) : []);
    } catch { setItems([]); }
  }, []);

  function persist(next: Array<{ href: string; visitedAt: string }>) {
    setItems(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function mark() {
    const h = href.trim();
    if (!h) return;
    const next = [{ href: h, visitedAt: new Date().toISOString() }, ...(items ?? []).filter((it) => it.href !== h)];
    setHref('');
    persist(next);
  }

  function clear() { persist([]); }

  if (!items) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/path/to/page"
            className="rounded border border-gray-300 px-2 py-1.5 font-mono text-sm md:col-span-2"
          />
          <button onClick={mark} className="rounded bg-yge-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700">
            Mark visited
          </button>
        </div>
        {items.length > 0 ? (
          <button onClick={clear} className="mt-3 text-[11px] text-gray-500 hover:text-red-700">Clear all</button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No visited pages yet. Add one above to start tracking.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {items.map((it) => (
            <li key={it.href + it.visitedAt} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <a href={it.href} className="font-mono text-xs text-yge-blue-700 hover:underline">{it.href}</a>
              <span className="font-mono text-[10px] text-gray-500">{it.visitedAt.slice(0, 19).replace('T', ' ')}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
