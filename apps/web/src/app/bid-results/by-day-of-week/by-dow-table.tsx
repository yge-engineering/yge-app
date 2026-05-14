'use client';

import { useEffect, useState } from 'react';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface BidResult { id: string; bidOpenedAt: string; outcome: string }

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ByDayOfWeekTable() {
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

  const counts: number[] = [0, 0, 0, 0, 0, 0, 0];
  const wins: number[] = [0, 0, 0, 0, 0, 0, 0];
  for (const r of results) {
    const d = new Date(r.bidOpenedAt);
    if (Number.isNaN(d.getTime())) continue;
    const dow = d.getDay();
    counts[dow] = (counts[dow] ?? 0) + 1;
    if (r.outcome === 'WON_BY_YGE') wins[dow] = (wins[dow] ?? 0) + 1;
  }
  const total = counts.reduce((a, b) => a + b, 0);

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Weekday</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {DAY_NAMES.map((name, i) => {
            const c = counts[i] ?? 0;
            const w = wins[i] ?? 0;
            return (
              <tr key={name} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{name}</td>
                <td className="px-3 py-2 text-right font-mono">{c}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{w}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{total > 0 ? `${((c / total) * 100).toFixed(1)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2 text-right font-mono text-gray-500">100.0%</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
