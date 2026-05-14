'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface YearStat {
  year: number;
  total: number;
  won: number;
  lost: number;
  tbd: number;
  noAward: number;
  wonCents: number;
}

interface Resp {
  lifetime: YearStat;
  years: YearStat[];
}

export function ByYearTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.years.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded yet.
      </p>
    );
  }

  function winRate(s: YearStat) {
    const decided = s.won + s.lost;
    return decided > 0 ? s.won / decided : 0;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Year</th>
            <th className="px-3 py-2 text-right">Bids</th>
            <th className="px-3 py-2 text-right">Won</th>
            <th className="px-3 py-2 text-right">Lost</th>
            <th className="px-3 py-2 text-right">No award</th>
            <th className="px-3 py-2 text-right">TBD</th>
            <th className="px-3 py-2 text-right">Win rate</th>
            <th className="px-3 py-2 text-right">Won $</th>
          </tr>
        </thead>
        <tbody>
          {data.years.map((s) => {
            const wr = winRate(s);
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={s.year} className="border-t border-gray-100">
                <td className="px-3 py-2 font-semibold">{s.year || '—'}</td>
                <td className="px-3 py-2 text-right font-mono">{s.total}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{s.won}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{s.lost}</td>
                <td className="px-3 py-2 text-right font-mono">{s.noAward}</td>
                <td className="px-3 py-2 text-right font-mono">{s.tbd}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>
                  {(wr * 100).toFixed(0)}%
                </td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={s.wonCents} /></td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">
            <td className="px-3 py-2">Lifetime</td>
            <td className="px-3 py-2 text-right font-mono">{data.lifetime.total}</td>
            <td className="px-3 py-2 text-right font-mono text-green-700">{data.lifetime.won}</td>
            <td className="px-3 py-2 text-right font-mono text-red-700">{data.lifetime.lost}</td>
            <td className="px-3 py-2 text-right font-mono">{data.lifetime.noAward}</td>
            <td className="px-3 py-2 text-right font-mono">{data.lifetime.tbd}</td>
            <td className="px-3 py-2 text-right font-mono">
              {(winRate(data.lifetime) * 100).toFixed(0)}%
            </td>
            <td className="px-3 py-2 text-right font-mono"><Money cents={data.lifetime.wonCents} /></td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
