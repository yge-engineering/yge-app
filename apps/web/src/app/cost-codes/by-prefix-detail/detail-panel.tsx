'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface CostCode { id: string; code?: string | null; description?: string | null }

export function ByPrefixDetail() {
  const [codes, setCodes] = useState<CostCode[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { costCodes: [] }))
      .then((j: { costCodes?: CostCode[] }) => setCodes(j.costCodes ?? []));
  }, []);

  if (!codes) return <p className="text-sm text-gray-500">Loading…</p>;
  if (codes.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No cost codes in the database yet.
      </p>
    );
  }

  const groups = new Map<string, CostCode[]>();
  for (const c of codes) {
    const raw = (c.code ?? '').trim().toUpperCase();
    const dash = raw.indexOf('-');
    const prefix = dash > 0 ? raw.slice(0, dash) : (raw || '(unknown)');
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(c);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([prefix, list]) => (
        <details key={prefix} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{prefix}</span>
            <span className="text-xs text-gray-600">{list.length} code{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {[...list].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')).map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/cost-codes/${c.id}`} className="font-mono font-medium text-yge-blue-700 hover:underline">
                  {c.code ?? c.id}
                </Link>
                <span className="text-[11px] text-gray-600">{c.description ?? ''}</span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
