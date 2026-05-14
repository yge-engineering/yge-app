'use client';

import { useEffect, useState } from 'react';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

const OUTCOMES = ['WON_BY_YGE', 'WON_BY_OTHER', 'NO_AWARD', 'TBD'];

export function CrossTab() {
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

  const years = new Set<string>();
  const grid = new Map<string, Map<string, number>>();
  for (const r of results) {
    const o = r.outcome || '(unknown)';
    const y = (r.bidOpenedAt ?? '').slice(0, 4) || '(unknown)';
    years.add(y);
    if (!grid.has(o)) grid.set(o, new Map());
    const row = grid.get(o)!;
    row.set(y, (row.get(y) ?? 0) + 1);
  }
  const sortedYears = [...years].sort((a, b) => b.localeCompare(a));
  const sortedOutcomes = [
    ...OUTCOMES.filter((o) => grid.has(o)),
    ...[...grid.keys()].filter((o) => !OUTCOMES.includes(o)),
  ];

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Outcome \\ Year</th>
            {sortedYears.map((y) => (
              <th key={y} className="px-3 py-2 text-right font-mono">{y}</th>
            ))}
            <th className="px-3 py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {sortedOutcomes.map((o) => {
            const row = grid.get(o) ?? new Map<string, number>();
            const rowTotal = [...row.values()].reduce((a, b) => a + b, 0);
            return (
              <tr key={o} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{o}</td>
                {sortedYears.map((y) => (
                  <td key={y} className="px-3 py-2 text-right font-mono">{row.get(y) ?? 0}</td>
                ))}
                <td className="px-3 py-2 text-right font-mono font-semibold">{rowTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
