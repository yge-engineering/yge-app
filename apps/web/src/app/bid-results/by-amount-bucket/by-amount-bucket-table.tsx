'use client';

import { useEffect, useState } from 'react';
import { ygeBid, type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Bucket { label: string; max: number; count: number; wins: number }

const BUCKETS: Array<{ label: string; max: number }> = [
  { label: '< $25k', max: 25_000_00 },
  { label: '$25k – $100k', max: 100_000_00 },
  { label: '$100k – $250k', max: 250_000_00 },
  { label: '$250k – $500k', max: 500_000_00 },
  { label: '$500k – $1M', max: 1_000_000_00 },
  { label: '$1M – $2M', max: 2_000_000_00 },
  { label: '$2M – $5M', max: 5_000_000_00 },
  { label: '$5M+', max: Number.POSITIVE_INFINITY },
];

export function ByAmountBucketTable() {
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

  const buckets: Bucket[] = BUCKETS.map((b) => ({ label: b.label, max: b.max, count: 0, wins: 0 }));
  let total = 0;
  for (const r of results) {
    const yge = ygeBid(r);
    const amount = yge?.amountCents;
    if (typeof amount !== 'number') continue;
    total += 1;
    for (const b of buckets) {
      if (amount < b.max) {
        b.count += 1;
        if (r.outcome === 'WON_BY_YGE') b.wins += 1;
        break;
      }
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Range</th>
            <th className="px-3 py-2 text-right">YGE bids</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Win rate</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((b) => {
            const wr = b.count > 0 ? b.wins / b.count : 0;
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={b.label} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{b.label}</td>
                <td className="px-3 py-2 text-right font-mono">{b.count}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{b.wins}</td>
                <td className={`px-3 py-2 text-right font-mono ${tone}`}>{b.count > 0 ? `${(wr * 100).toFixed(0)}%` : '—'}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Total (with YGE amount)</td>
            <td className="px-3 py-2 text-right font-mono">{total}</td>
            <td className="px-3 py-2"></td>
            <td className="px-3 py-2"></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
