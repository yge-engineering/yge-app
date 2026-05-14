'use client';

import { useEffect, useState } from 'react';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function LossesByYear() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  const losses = results.filter((r) => r.outcome === 'WON_BY_OTHER');
  if (losses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No losses recorded yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const r of losses) {
    const y = (r.bidOpenedAt ?? '').slice(0, 4) || '(unknown)';
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Losses</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, count]) => (
            <tr key={y} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{y}</td>
              <td className="px-3 py-2 text-right font-mono text-red-700">{count}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total losses</td>
            <td className="px-3 py-2 text-right font-mono">{losses.length}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
