'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Match {
  id: string;
  name: string;
  type: string;
  contactName: string | null;
  contactEmail: string | null;
}

export function CustomerSearchClient() {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);

  useEffect(() => {
    if (q.trim().length < 1) { setMatches(null); return; }
    const t = setTimeout(() => {
      fetch(`${apiBaseUrl()}/api/customers/search?q=${encodeURIComponent(q.trim())}`, { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j: { matches?: Match[] }) => setMatches(j.matches ?? []));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input type="search" autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type to search…" className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm" />
      {matches && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {matches.length === 0 ? (
            <li className="px-4 py-3 text-sm text-gray-500">No matches.</li>
          ) : (
            matches.map((m) => (
              <li key={m.id} className="px-4 py-2">
                <Link href={`/customers/${m.id}`} className="text-sm font-semibold text-yge-blue-700 hover:underline">
                  {m.name}
                </Link>
                <div className="text-xs text-gray-500">
                  {m.type}{m.contactName ? ` · ${m.contactName}` : ''}{m.contactEmail ? ` · ${m.contactEmail}` : ''}
                </div>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
