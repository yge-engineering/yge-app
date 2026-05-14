'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'yge-app-favorites';

interface Favorite { href: string; title: string }

export function FavoritesPanel() {
  const [items, setItems] = useState<Favorite[] | null>(null);
  const [href, setHref] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      setItems(raw ? (JSON.parse(raw) as Favorite[]) : []);
    } catch {
      setItems([]);
    }
  }, []);

  function persist(next: Favorite[]) {
    setItems(next);
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  function add() {
    const h = href.trim();
    const t = title.trim();
    if (!h || !t) return;
    const next = [...(items ?? []), { href: h, title: t }];
    setHref('');
    setTitle('');
    persist(next);
  }

  function remove(i: number) {
    const next = [...(items ?? [])];
    next.splice(i, 1);
    persist(next);
  }

  if (!items) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="rounded border border-gray-200 bg-white p-3 shadow-sm">
        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm"
          />
          <input
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/path/to/page"
            className="rounded border border-gray-300 px-2 py-1.5 text-sm font-mono"
          />
          <button onClick={add} className="rounded bg-yge-blue-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-yge-blue-700">
            Add favorite
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
          No favorites yet. Add one above.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {items.map((it, i) => (
            <li key={`${it.href}-${i}`} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
              <a href={it.href} className="font-medium text-yge-blue-700 hover:underline">{it.title}</a>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-gray-500">{it.href}</span>
                <button onClick={() => remove(i)} className="text-[11px] text-gray-500 hover:text-red-700">Remove</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
