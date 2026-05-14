// Top-N cost-code usage panel. Reads /api/cost-codes/stats and shows
// the top 10 by bid $.

'use client';

import { useEffect, useState } from 'react';
import { Money } from './money';

function apiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
}

interface Stat {
  code: string;
  bidUses: number;
  bidCents: number;
  actUses: number;
  actCents: number;
}

export function CostCodeStatsPanel() {
  const [stats, setStats] = useState<Stat[] | null>(null);

  useEffect(() => {
    fetch(`${apiBaseUrl()}/api/cost-codes/stats`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { stats: [] }))
      .then((j: { stats?: Stat[] }) => setStats(j.stats ?? []));
  }, []);

  if (!stats) {
    return <p className="text-sm text-gray-500">Loading code usage…</p>;
  }
  if (stats.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No usage data yet. Cost codes show up here once they appear on imported
        estimates or daily reports.
      </p>
    );
  }

  const top = stats.slice(0, 10);
  return (
    <div className="mb-6 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 bg-gray-50 px-4 py-2">
        <h2 className="text-sm font-semibold text-gray-900">Top 10 codes by bid $</h2>
        <p className="text-xs text-gray-500">
          Where your bid money goes most — across all imported estimates.
        </p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500">
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2 text-right">Bid uses</th>
            <th className="px-3 py-2 text-right">Bid $</th>
            <th className="px-3 py-2 text-right">Actual uses</th>
            <th className="px-3 py-2 text-right">Actual $</th>
          </tr>
        </thead>
        <tbody>
          {top.map((s) => (
            <tr key={s.code} className="border-t border-gray-100">
              <td className="px-3 py-2 font-mono text-[12px]">{s.code}</td>
              <td className="px-3 py-2 text-right">{s.bidUses}</td>
              <td className="px-3 py-2 text-right font-mono">
                <Money cents={s.bidCents} />
              </td>
              <td className="px-3 py-2 text-right">{s.actUses}</td>
              <td className="px-3 py-2 text-right font-mono">
                <Money cents={s.actCents} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
