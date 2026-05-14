'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ImportedEstimate {
  id: string;
  jobNumber?: string;
  projectName?: string;
  rateType?: string | null;
  bidPriceCents?: number;
  updatedAt?: string;
}

export function ByRateTypeDetail() {
  const [items, setItems] = useState<ImportedEstimate[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/imported-estimates`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { importedEstimates: [] }))
      .then((j: { importedEstimates?: ImportedEstimate[] }) => setItems(j.importedEstimates ?? []));
  }, []);

  if (!items) return <p className="text-sm text-gray-500">Loading…</p>;
  if (items.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No imported estimates yet.
      </p>
    );
  }

  const groups = new Map<string, ImportedEstimate[]>();
  for (const ie of items) {
    const k = (ie.rateType ?? '').trim().toUpperCase() || '(unknown)';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(ie);
  }
  const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      {sorted.map(([rt, list]) => (
        <details key={rt} className="rounded border border-gray-200 bg-white shadow-sm">
          <summary className="flex cursor-pointer items-center justify-between px-3 py-2 text-sm">
            <span className="font-mono font-semibold">{rt}</span>
            <span className="text-xs text-gray-600">{list.length} workbook{list.length === 1 ? '' : 's'}</span>
          </summary>
          <ul className="divide-y divide-gray-100 px-3 pb-2 text-sm">
            {[...list].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')).map((ie) => (
              <li key={ie.id} className="flex items-center justify-between gap-3 py-1.5">
                <Link href={`/imported-estimates/${ie.id}`} className="font-medium text-yge-blue-700 hover:underline">
                  {ie.projectName ?? ie.id}
                </Link>
                <span className="font-mono text-[10px] text-gray-500">
                  {ie.jobNumber ?? '—'} · {typeof ie.bidPriceCents === 'number' ? <Money cents={ie.bidPriceCents} /> : '—'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
