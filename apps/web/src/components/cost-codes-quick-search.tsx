'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Match { id: string; code: string; name: string; category: string | null }

export function CostCodesQuickSearch() {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Match[]>([]);

  useEffect(() => {
    if (q.trim().length < 1) { setMatches([]); return; }
    const t = setTimeout(() => {
      fetch(`${apiBaseUrl()}/api/cost-codes/search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j: { matches?: Match[] }) => setMatches(j.matches ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mb-4">
      <input
        type="search"
        placeholder="Quick filter cost codes…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm"
      />
      {q.trim().length > 0 && (
        <ul className="mt-2 max-h-80 overflow-y-auto rounded border border-gray-200 bg-white shadow-sm">
          {matches.length === 0 ? (
            <li className="px-3 py-2 text-xs text-gray-500">No matches.</li>
          ) : (
            matches.map((m) => (
              <li key={m.id} className="border-t border-gray-100 px-3 py-2 text-xs">
                <span className="font-mono font-semibold text-yge-blue-900">{m.code}</span>
                {' '}<span className="text-gray-900">{m.name}</span>
                {m.category && <span className="ml-2 text-gray-500">· {m.category}</span>}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
