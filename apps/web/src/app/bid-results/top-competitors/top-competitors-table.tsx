'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { computeBidResultRollup, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function TopCompetitorsTable() {
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

  const rollup = computeBidResultRollup(results);
  if (rollup.competitorAppearances.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No competitor data yet.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Competitor</th>
            <th className="px-3 py-2 text-right">Appearances</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Win share</th>
          </tr>
        </thead>
        <tbody>
          {rollup.competitorAppearances.map((c) => {
            const ws = c.appearances > 0 ? c.wins / c.appearances : 0;
            return (
              <tr key={c.bidderName} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold text-gray-900">
                  <Link
                    href={`/bid-results/competitor-detail?name=${encodeURIComponent(c.bidderName)}`}
                    className="text-yge-blue-500 hover:underline"
                  >
                    {c.bidderName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-right font-mono">{c.appearances}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{c.wins}</td>
                <td className="px-3 py-2 text-right font-mono">{(ws * 100).toFixed(0)}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
