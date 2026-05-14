'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Bidder { isYge?: boolean; amountCents?: number }
interface BidResult { id: string; bidOpenedAt: string; outcome: string; bidders?: Bidder[] }

interface Bucket { key: string; total: number; wins: number; losses: number; wonCents: number }

function quarterOf(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()} Q${q}`;
}

export function ByQuarterTable() {
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
    const key = quarterOf(r.bidOpenedAt);
    if (!key) continue;
    let b = buckets.get(key);
    if (!b) { b = { key, total: 0, wins: 0, losses: 0, wonCents: 0 }; buckets.set(key, b); }
    b.total += 1;
    if (r.outcome === 'WON_BY_YGE') {
      b.wins += 1;
      const yge = (r.bidders ?? []).find((bd) => bd.isYge);
      b.wonCents += yge?.amountCents ?? 0;
    }
    if (r.outcome === 'WON_BY_OTHER') b.losses += 1;
  }
  const rows = [...buckets.values()].sort((a, b) => b.key.localeCompare(a.key));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Quarter</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Losses</th>
            <th className="px-3 py-2 text-right">Win rate</th>
            <th className="px-3 py-2 text-right">Won $</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const decided = b.wins + b.losses;
            const wr = decided > 0 ? b.wins / decided : 0;
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={b.key} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{b.key}</td>
                <td className="px-3 py-2 text-right font-mono">{b.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{b.wins}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{b.losses}</td>
                <td className={`px-3 py-2 text-right font-mono ${tone}`}>{decided > 0 ? `${(wr * 100).toFixed(0)}%` : '—'}</td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={b.wonCents} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
