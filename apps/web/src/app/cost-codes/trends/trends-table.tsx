'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Trend {
  code: string;
  latestCents: number;
  previousCents: number;
  deltaPct: number;
  samples: number;
  direction: 'up' | 'down' | 'flat';
}

export function TrendsTable() {
  const [trends, setTrends] = useState<Trend[] | null>(null);
  const [filter, setFilter] = useState<'all' | 'up' | 'down' | 'flat'>('all');

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes/trends`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { trends: [] }))
      .then((j: { trends?: Trend[] }) => setTrends(j.trends ?? []));
  }, []);

  if (trends === null) return <p className="text-sm text-gray-500">Loading…</p>;
  if (trends.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        Need at least 2 imported estimates for any cost code to compute a trend.
      </p>
    );
  }

  const filtered = filter === 'all' ? trends : trends.filter((t) => t.direction === filter);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {(['all', 'up', 'down', 'flat'] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded px-3 py-1 text-xs font-semibold ${
              filter === f ? 'bg-yge-blue-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {f === 'all' ? 'All' : f === 'up' ? '↑ Climbing' : f === 'down' ? '↓ Falling' : '→ Flat'}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500">
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2 text-right">Previous</th>
              <th className="px-3 py-2 text-right">Latest</th>
              <th className="px-3 py-2 text-right">Δ %</th>
              <th className="px-3 py-2 text-right">Samples</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const tone = t.direction === 'up' ? 'text-red-700' : t.direction === 'down' ? 'text-green-700' : 'text-gray-700';
              return (
                <tr key={t.code} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono text-[12px]">{t.code}</td>
                  <td className="px-3 py-2 text-right font-mono"><Money cents={t.previousCents} /></td>
                  <td className="px-3 py-2 text-right font-mono font-semibold"><Money cents={t.latestCents} /></td>
                  <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>
                    {t.deltaPct > 0 ? '+' : ''}
                    {(t.deltaPct * 100).toFixed(0)}%
                  </td>
                  <td className="px-3 py-2 text-right">{t.samples}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
