'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function WinsByYear() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  const wins = results.filter((r) => r.outcome === 'WON_BY_YGE');
  if (wins.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No recorded YGE wins yet.
      </p>
    );
  }

  const counts = new Map<string, { count: number; cents: number }>();
  for (const r of wins) {
    const y = (r.bidOpenedAt ?? '').slice(0, 4) || '(unknown)';
    let row = counts.get(y);
    if (!row) { row = { count: 0, cents: 0 }; counts.set(y, row); }
    row.count += 1;
    const yge = (r.bidders ?? []).find((b) => b.isYge);
    row.cents += yge?.amountCents ?? 0;
  }
  const rows = [...counts.entries()].sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Won $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([y, r]) => (
            <tr key={y} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{y}</td>
              <td className="px-3 py-2 text-right font-mono text-green-700">{r.count}</td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={r.cents} /></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total wins</td>
            <td className="px-3 py-2 text-right font-mono">{wins.length}</td>
            <td className="px-3 py-2 text-right font-mono"><Money cents={[...counts.values()].reduce((s, r) => s + r.cents, 0)} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
