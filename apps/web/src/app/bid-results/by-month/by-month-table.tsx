'use client';

import { useEffect, useState } from 'react';
import { Money } from '@/components/money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Month {
  month: string;
  wins: number;
  losses: number;
  winsCents: number;
}

interface Resp {
  months: Month[];
}

export function ByMonthTable() {
  const [data, setData] = useState<Resp | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/bid-results/stats/sparkline`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Resp | null) => setData(j));
  }, []);

  if (!data) return <p className="text-sm text-gray-500">Loading…</p>;
  if (data.months.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-500">
        No bid results recorded yet.
      </p>
    );
  }

  // Newest first for visual scan.
  const months = [...data.months].sort((a, b) => b.month.localeCompare(a.month));

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Month</th>
            <th className="px-3 py-2 text-right">Wins</th>
            <th className="px-3 py-2 text-right">Losses</th>
            <th className="px-3 py-2 text-right">Win rate</th>
            <th className="px-3 py-2 text-right">Won $</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m) => {
            const decided = m.wins + m.losses;
            const wr = decided > 0 ? m.wins / decided : 0;
            const tone = wr >= 0.3 ? 'text-green-700' : wr >= 0.15 ? 'text-amber-700' : 'text-red-700';
            return (
              <tr key={m.month} className="border-t border-gray-100">
                <td className="px-3 py-2 font-mono font-semibold">{m.month}</td>
                <td className="px-3 py-2 text-right font-mono text-green-700">{m.wins}</td>
                <td className="px-3 py-2 text-right font-mono text-red-700">{m.losses}</td>
                <td className={`px-3 py-2 text-right font-mono font-semibold ${tone}`}>
                  {decided > 0 ? `${(wr * 100).toFixed(0)}%` : '—'}
                </td>
                <td className="px-3 py-2 text-right font-mono"><Money cents={m.winsCents} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
