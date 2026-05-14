'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface LineMatch {
  description: string;
  costCode: string | null;
}

interface Match {
  id: string;
  jobNumber: string;
  projectName: string;
  client: string | null;
  notesExcerpt: string | null;
  lineMatches: LineMatch[];
}

export function SearchClient() {
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setMatches(null);
      return;
    }
    const t = setTimeout(() => {
      setBusy(true);
      fetch(`${apiBaseUrl()}/api/imported-estimates/search?q=${encodeURIComponent(q.trim())}`, {
        cache: 'no-store',
      })
        .then((r) => (r.ok ? r.json() : { matches: [] }))
        .then((j: { matches?: Match[] }) => setMatches(j.matches ?? []))
        .finally(() => setBusy(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div>
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type 2+ chars to search…"
        className="mb-4 w-full rounded border border-gray-300 px-3 py-2 text-sm shadow-sm"
        autoFocus
      />
      {busy && <p className="text-xs text-gray-500">Searching…</p>}
      {matches !== null && matches.length === 0 && q.trim().length >= 2 && (
        <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
          No matches.
        </p>
      )}
      {matches && matches.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white shadow-sm">
          {matches.map((m) => (
            <li key={m.id} className="px-4 py-3">
              <Link
                href={`/imported-estimates/${m.id}`}
                className="text-sm font-semibold text-yge-blue-700 hover:underline"
              >
                {m.jobNumber} · {m.projectName}
              </Link>
              {m.client && (
                <div className="text-xs text-gray-600">Client: {m.client}</div>
              )}
              {m.notesExcerpt && (
                <p className="mt-1 text-xs italic text-gray-700">
                  notes: …{m.notesExcerpt}
                </p>
              )}
              {m.lineMatches.length > 0 && (
                <ul className="mt-1 text-[11px] text-gray-600">
                  {m.lineMatches.map((l, i) => (
                    <li key={i}>
                      <span className="font-mono">{l.costCode ?? '—'}</span> · {l.description}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
