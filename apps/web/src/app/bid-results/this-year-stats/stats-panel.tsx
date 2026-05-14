'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';
import { type BidResult } from '@yge/shared';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

export function ThisYearStats() {
  const [results, setResults] = useState<BidResult[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { results: [] }))
      .then((j: { results?: BidResult[] }) => setResults(j.results ?? []));
  }, []);

  if (!results) return <p className="text-sm text-gray-500">Loading…</p>;
  const currentYear = String(new Date().getFullYear());
  const yearly = results.filter((r) => (r.bidOpenedAt ?? '').slice(0, 4) === currentYear);

  if (yearly.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded in {currentYear} yet.
      </p>
    );
  }

  const counts = new Map<string, number>();
  let wonCents = 0;
  for (const r of yearly) {
    counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
    if (r.outcome === 'WON_BY_YGE') {
      const yge = (r.bidders ?? []).find((b) => b.isYge);
      wonCents += yge?.amountCents ?? 0;
    }
  }

  const wins = counts.get('WON_BY_YGE') ?? 0;
  const losses = counts.get('WON_BY_OTHER') ?? 0;
  const decided = wins + losses;
  const winRate = decided > 0 ? wins / decided : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Bids" value={yearly.length} />
        <Tile label="Wins" value={wins} tone="good" />
        <Tile label="Win rate" value={`${(winRate * 100).toFixed(0)}%`} tone={winRate >= 0.25 ? 'good' : winRate >= 0.15 ? 'warn' : 'bad'} />
        <Tile label="Won $" value={<Money cents={wonCents} />} />
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
                <td className="px-3 py-2 text-right font-mono text-gray-500">{((count / yearly.length) * 100).toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'good' | 'bad' | 'warn' }) {
  const toneClass = tone === 'good' ? 'text-green-700' : tone === 'bad' ? 'text-red-700' : tone === 'warn' ? 'text-amber-700' : 'text-yge-blue-900';
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}
