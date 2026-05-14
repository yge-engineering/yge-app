'use client';

import { useEffect, useState } from 'react';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function WinRateByYear() {
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

  const buckets = new Map<string, { wins: number; losses: number }>();
  for (const r of results) {
    const y = (r.bidOpenedAt ?? '').slice(0, 4) || '(unknown)';
    let b = buckets.get(y);
    if (!b) { b = { wins: 0, losses: 0 }; buckets.set(y, b); }
    if (r.outcome === 'WON_BY_YGE') b.wins += 1;
    if (r.outcome === 'WON_BY_OTHER') b.losses += 1;
  }
  const rows = [...buckets.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Losses</th>
            <th className="px-3 py-2 text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, b]) => {
            const decided = b.wins + b.losses;
            const wr = decided > 0 ? b.wins / decided : 0;
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={y} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{y}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{b.wins}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{b.losses}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>{decided > 0 ? `${(wr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
