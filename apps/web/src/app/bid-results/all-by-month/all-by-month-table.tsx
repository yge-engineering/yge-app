'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Bidder { isYge?: boolean; amountCents?: number }
interface BidResult { id: string; bidOpenedAt: string; outcome: string; bidders?: Bidder[] }

interface Bucket { month: string; total: number; wins: number; losses: number; wonCents: number }

export function AllByMonthTable() {
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

  const buckets = new Map<string, Bucket>();
  for (const r of results) {
    const m = (r.bidOpenedAt ?? '').slice(0, 7);
    if (!m) continue;
    let b = buckets.get(m);
    if (!b) { b = { month: m, total: 0, wins: 0, losses: 0, wonCents: 0 }; buckets.set(m, b); }
    b.total += 1;
    if (r.outcome === 'WON_BY_YGE') {
      b.wins += 1;
      const yge = (r.bidders ?? []).find((x) => x.isYge);
      b.wonCents += yge?.amountCents ?? 0;
    }
    if (r.outcome === 'WON_BY_OTHER') b.losses += 1;
  }
  const rows = [...buckets.values()].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Losses</th>
            <th className="px-3 py-2 text-right">Won $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => (
            <tr key={b.month} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono font-semibold">{b.month}</td>
              <td className="px-3 py-2 text-right font-mono">{b.total}</td>
              <td className="px-3 py-2 text-right font-mono text-green-700">{b.wins}</td>
              <td className="px-3 py-2 text-right font-mono text-red-700">{b.losses}</td>
              <td className="px-3 py-2 text-right font-mono"><Money cents={b.wonCents} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
