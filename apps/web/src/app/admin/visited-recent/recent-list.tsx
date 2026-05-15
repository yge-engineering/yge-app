'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface Entry {
  path: string;
  title?: string;
  at: string;
}

const KEY = 'yge.visited.recent.v1';

export function RecentList() {
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEntries(parsed as Entry[]);
        }
      }
    } catch {
      /* swallow */
    }
  }, []);

  function clear() {
    localStorage.removeItem(KEY);
    setEntries([]);
  }

  if (entries.length === 0) {
    return (
      <div className="rounded border border-dashed border-gray-300 bg-gray-50 p-6 text-center text-sm text-gray-500">
        No recent pages tracked yet. Move around the app and they'll show up here.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="text-xs text-gray-500">{entries.length} entries.</div>
      <ul className="divide-y divide-gray-100 rounded border border-gray-200 bg-white shadow-sm">
        {entries.map((e, i) => (
          <li key={`${e.path}-${i}`} className="flex items-center justify-between px-3 py-2 text-sm">
            <Link href={e.path} className="text-yge-blue-700 hover:underline">
              {e.title ?? e.path}
            </Link>
            <span className="text-[11px] text-gray-500">{new Date(e.at).toLocaleString()}</span>
          </li>
        ))}
      </ul>
      <button
        onClick={clear}
        className="rounded border border-red-300 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
      >
        Clear history
      </button>
    </div>
  );
}
