'use client';

import { useEffect, useState } from 'react';
import { ygeRank, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ByRankTable() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  if (results.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  for (const r of results) {
    const rank = ygeRank(r);
    const key = typeof rank === 'number' ? `#${rank}` : '(no rank)';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows = [...counts.entries()].sort((a, b) => {
    const na = a[0].startsWith('#') ? Number(a[0].slice(1)) : Number.POSITIVE_INFINITY;
    const nb = b[0].startsWith('#') ? Number(b[0].slice(1)) : Number.POSITIVE_INFINITY;
    return na - nb;
  });
  const total = results.length;

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">YGE rank</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([rank, count]) => {
            const tone = rank === '#1' ? 'text-green-700' : rank === '(no rank)' ? 'text-gray-500' : '';
            return (
              <tr key={rank} className="border-t border-gray-100">
                <td className={`px-3 py-2 font-mono font-semibold ${tone}`}>{rank}</td>
                <td className="px-3 py-2 text-right font-mono">{count}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / total) * 100).toFixed(1)}%</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
