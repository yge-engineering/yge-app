'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ThisMonthStats() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  const now = new Date();
  const yyyyMm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const monthly = results.filter((r) => (r.bidOpenedAt ?? '').startsWith(yyyyMm));

  if (monthly.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded in {yyyyMm} yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  let wonCents = 0;
  for (const r of monthly) {
    counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
    if (r.outcome === 'WON_BY_YGE') {
      const yge = (r.bidders ?? []).find((b) => b.isYge);
      wonCents += yge?.amountCents ?? 0;
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
        <div className="text-xs text-gray-500">{yyyyMm}: {monthly.length} bid tab{monthly.length === 1 ? '' : 's'}</div>
        <div className="text-2xl font-bold text-green-700"><Money cents={wonCents} /> won this month</div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Outcome</th>
              <th className="px-3 py-2 text-right">Count</th>
              <th className="px-3 py-2 text-right">Share</th>
            </tr>
          </thead>
          <tbody>
            {[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([outcome, count]) => (
              <tr key={outcome} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{outcome}</td>
                <td className="px-3 py-2 text-right font-mono">{count}</td>
                <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / monthly.length) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
