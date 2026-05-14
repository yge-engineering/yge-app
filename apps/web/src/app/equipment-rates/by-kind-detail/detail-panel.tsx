'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Rate {
  id: string;
  code?: string | null;
  name?: string | null;
  kind?: 'OWNED' | 'RENTAL' | string | null;
  hourlyCents?: number | null;
}

export function ByKindDetail() {
  const [rates, setRates] = useState<Rate[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/equipment-rates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { equipmentRates?: Rate[] } | null) => setRates(j?.equipmentRates ?? []));
  }, []);

  if (!rates) return <p className="text-sm text-gray-500">Loading…</p>;
  if (rates.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No equipment rate records yet.
      </p>
    );
  }

  const groups = new Map<string, Rate[]>();
  for (const r of rates) {
    const k = (r.kind ?? '(unknown)').toUpperCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(r);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([kind, list]) => (
        <details key={kind} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{kind}</span>
            <span className="text-xs text-gray-600">{list.length} record{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {[...list].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')).map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/equipment-rates/${r.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {r.code ?? r.id}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">
                  {r.name ?? ''} {typeof r.hourlyCents === 'number' ? <><Money cents={r.hourlyCents} /> /hr</> : null}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
