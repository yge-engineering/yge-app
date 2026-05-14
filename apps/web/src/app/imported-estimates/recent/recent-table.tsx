'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface ImportedEstimate {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  jobNumber?: string;
  projectName?: string;
  bidPriceCents?: number;
}

export function RecentImportedEstimatesTable() {
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

  const recent = [...items]
    .sort((a, b) => (b.updatedAt ?? b.createdAt ?? '').localeCompare(a.updatedAt ?? a.createdAt ?? ''))
    .slice(0, 25);

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Updated</th>
            <th className="px-3 py-2">Job #</th>
            <th className="px-3 py-2">Project</th>
            <th className="px-3 py-2 text-right">Bid price</th>
          </tr>
        </thead>
        <tbody>
          {recent.map((ie) => (
            <tr key={ie.id} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-xs text-gray-700">{(ie.updatedAt ?? ie.createdAt ?? '').slice(0, 10) || '—'}</td>
              <td className="px-3 py-2 font-mono text-xs">{ie.jobNumber ?? '—'}</td>
              <td className="px-3 py-2">
                <Link href={`/imported-estimates/${ie.id}`} className="font-semibold text-yge-blue-700 hover:underline">
                  {ie.projectName ?? ie.id}
                </Link>
              </td>
              <td className="px-3 py-2 text-right font-mono">
                {typeof ie.bidPriceCents === 'number' ? <Money cents={ie.bidPriceCents} /> : <span className="text-gray-400">—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
